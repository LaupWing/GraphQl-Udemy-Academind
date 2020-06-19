const User = require('../models/user');
const bcrypt = require('bcryptjs');
const validator = require('validator');
const jwt = require('jsonwebtoken');
const Post = require('../models/post');
const {clearImage} = require('../util/file')

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
            error.data = errors;
            error.code = 422;
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
    },
    async createPost({postInput}, req){
        if(!req.isAuth){
            const error = new Error('Not Authenitcated');
            error.code = 401;
            throw error;
        }
        const errors = [];
        if(validator.isEmpty(postInput.title) || !validator.isLength(postInput.title, {min:5})){
            errors.push({
                message: 'Title is invalid'
            });
        }
        if(validator.isEmpty(postInput.content) || !validator.isLength(postInput.content, {min:5})){
            errors.push({
                message: 'Content is invalid'
            });
        }
        if(errors.length>0){
            const error = new Error('Invalid input');
            error.data = errors;
            error.code = 422;
            throw error;
        }
        const user = await User.findById(req.userId);
        if(!user){
            const error = new Error('User not found');
            error.code = 401;
            throw error;
        }
        const post = new Post({
            title: postInput.title,
            content: postInput.content,
            imageUrl: postInput.imageUrl,
            creator: user
        });
        const createdPost = await post.save();
        user.posts.push(createdPost);
        user.save();
        return {
            ...createdPost,
            _id: createdPost._id.toString(), 
            createdAt: createdPost.createdAt.toISOString(),
            updatedAt: createdPost.updatedAt.toISOString()
        }
    },
    async posts({page}, req){
        if(!req.isAuth){
            const error = new Error('Not Authenitcated');
            error.code = 401;
            throw error;
        }
        if(!page){
            page = 1;
        }
        const perPage = 2;
        const totalPosts = await Post.find().countDocuments();
        const posts = await Post
            .find()
            .sort({createdAt: -1})
            .skip((page-1) * perPage)
            .limit(perPage)
            .popupalate('creator');
        
        return {posts: posts.map(x=> (
            {
                ...x._doc,
                _id: x._id.toString(),
                createdAt: x.createdAt.toISOString(),
                updatedAt: x.updatedAt.toISOString(),
            }
            )), totalPosts};
    },
    async post({id}, req){
        if(!req.isAuth){
            const error = new Error('Not Authenitcated');
            error.code = 401;
            throw error;
        }
        const post = await Post.findById(id).populate('creator');
        if(!post){
            const error = new Error('Post not found');
            error.code = 404;
            throw error;
        }
        return {
            ...post._doc,
            _id: post._id.toString(),
            createdAt: post.createdAt.toISOString(),
            updatedAt: post.updatedAt.toISOString(),
        }
    },
    async updatePost({id, postInput}, req){
        if(!req.isAuth){
            const error = new Error('Not Authenitcated');
            error.code = 401;
            throw error;
        }
        const post = await Post.findById(id).populate('creator');
        if(!post){
            const error = new Error('Post not found');
            error.code = 404;
            throw error;
        }
        if(post.creator._id.toString() !== req.userId.toString()){
            const error = new Error('Not Authroized');
            error.code = 403;
            throw error;
        }
        
        const errors = [];
        if(validator.isEmpty(postInput.title) || !validator.isLength(postInput.title, {min:5})){
            errors.push({
                message: 'Title is invalid'
            });
        }
        if(validator.isEmpty(postInput.content) || !validator.isLength(postInput.content, {min:5})){
            errors.push({
                message: 'Content is invalid'
            });
        }
        if(errors.length>0){
            const error = new Error('Invalid input');
            error.data = errors;
            error.code = 422;
            throw error;
        }

        post.title = postInput.title;
        post.content = postInput.content;
        if(postInput.imageUrl !== 'undefined'){
            post.imageUrl = postInput.imageUrl;
        }
        const updatedPost = await post.save();
        return{
            ...updatedPost._doc,
            _id: updatedPost._id.toString(),
            createdAt: updatedPost.createdAt.toISOString(),
            updatedAt: updatedPost.updatedAt.toISOString(),
        };
    },
    async deletePost({id},req){
        if(!req.isAuth){
            const error = new Error('Not Authenitcated');
            error.code = 401;
            throw error;
        }
        const post = await Post.findById(id).populate('creator');
        if(!post){
            const error = new Error('Post not found');
            error.code = 404;
            throw error;
        }
        if(post.creator.toString() !== req.userId.toString()){
            const error = new Error('Not Authroized');
            error.code = 403;
            throw error;
        }
        clearImage(post.imageUrl);
        await Post.findByIdAndRemove(id);
        const user = await User.findById(req.userId);
        user.posts.pull(id);
        await user.save();
        return true;
    }
}