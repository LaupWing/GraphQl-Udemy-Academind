const User = require('../models/user');
const bcrypt = require('bcryptjs');
const validator = require('validator');
const jwt = require('jsonwebtoken');

module.exports = {
    createUser: async function({userInput}, req){
        const errors = [];
        if(!validator.isEmail(userInput.email)){
            errors.push({message: 'Email is invalid'});
        }
        if(
            validator.isEmpty(userInput.password) ||
            !validator.isLength(userInput.password, {min:5})
        ){
            errors.push({message:'password to short'})
        }
        if(errors.length>0){
            const error = new Error('Invalid input');
            throw error;
        }
        const exists = await User.findOne({email: userInput.email});
        if(exists){
            const error = new Error('User exists already!');
            error.data = errors;
            error.code = 422;
            throw error;
        }
        const hashedPw = await bcrypt.hash(userInput.password, 12);
        const user = new User({
            email: userInput.email,
            name: userInput.name,
            password: hashedPw
        });
        console.log(user)
        const createdUser = await user.save();
        return {...createdUser._doc, _id: createdUser._id.toString()}
    },
    async login({email, password}){
        const user = await User.findOne({email});
        if(!user){
            const error = new Error('User not found');
            error.code = 401;
            throw error;
        }
        const isEqual = bcrypt.compare(password, user.password);
        if(!isEqual){
            const error = new Error('Password is incorrect.');
            error.code = 401;
            throw error;
        }
        const token = jwt.sign({
            userId: user._id.toString(),
            email: user.email
        }, 'secret', {
            expiresIn: '1h'
        });

        return {token, userId: user._id.toString()};
    }
}