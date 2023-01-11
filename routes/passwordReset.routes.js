const express = require("express");
const router = express.Router();
const { User } = require("../models/user.model");
const Token = require("../models/token.model");
const crypto = require("crypto");
const sendEmail = require("../utils/sendEmail");
const Joi = require("joi");
const passwordComplexity = require("joi-password-complexity");
const bcrypt = require("bcrypt");

// SEND PASSWORD LINK
router.post("/password-reset", async (req, res) => {
  try {
    const emailSchema = Joi.object({
      email: Joi.string().email().required().label("Email"),
    });

    const { error } = emailSchema.validate(req.body);
    if (error)
      return res.status(400).send({message: error.details[0].message});

    let user = await User.findOne({email: req.body.email});
    if (!user)
      return res.status(400).send({message: "User with given email does not exist!"});

    let token = await Token.findOne({userId: user._id});
    if (!token) {
      token = await new Token({
        userId: user._id,
        token: crypto.randomBytes(32).toString("hex"),
      }).save();
    }

    const url = `${process.env.BASE_URL}/password-reset/${user._id}/${token.token}/`;
		await sendEmail(user.email, "Password Reset", url);
        res.status(200).send({message: "Password reset link sent to your email account"});
  } catch (error) {
    res.status(500).send({message: "Internal Server Error"});
  }
});

// VERIFY URL
router.get("/password-reset/:id/:token", async (req, res) => {
    try {
        const user = await User.findOne({ _id: req.params.id });
		if (!user) return res.status(400).send({message: "Invalid link"});

		const token = await Token.findOne({
			userId: user._id,
			token: req.params.token,
		});
		if (!token) return res.status(400).send({message: "Invalid link"});

		res.status(200).send("Valid Url");
    } catch (error) {
        res.status(500).send({message: "Internal Server Error"});
    }
});

// RESET PASSWORD
router.post("/password-reset/:id/:token", async (req, res) => {
	try {
		const passwordSchema = Joi.object({
			password: passwordComplexity().required().label("Password"),
		});
		const { error } = passwordSchema.validate(req.body);
		if (error)
			return res.status(400).send({message: error.details[0].message});

            const user = await User.findOne({ _id: req.params.id });
            if (!user) return res.status(400).send({message: "Invalid link"});
    
            const token = await Token.findOne({
                userId: user._id,
                token: req.params.token,
            });
            if (!token) return res.status(400).send({message: "Invalid link"});
    
            const salt = await bcrypt.genSalt(Number(10));
            const hashPassword = await bcrypt.hash(req.body.password, salt);
    
            user.password = hashPassword;
            await user.save();
            await token.remove();
    
            res.status(200).send({message: "Password reset successfully"});
	} catch (error) {
		res.status(500).send({message: "Internal Server Error"});
	}
});

module.exports = router;