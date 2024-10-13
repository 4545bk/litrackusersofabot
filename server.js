require('dotenv').config();
const { Telegraf } = require('telegraf');
const mongoose = require('mongoose');
const next = require('next');

// MongoDB connection URI
const mongoURI = process.env.MONGODB_URI;

// Connect to MongoDB
mongoose.connect(mongoURI)
    .then(() => {
        console.log('MongoDB connected successfully');
    })
    .catch(err => {
        console.error('MongoDB connection error:', err);
    });

// Define a schema and model for users
const userSchema = new mongoose.Schema({
    id: { type: Number, unique: true },
    username: String,
    first_name: String,
    last_name: String,
});

const User = mongoose.models.User || mongoose.model('User', userSchema);

// Initialize the bot with your token
const bot = new Telegraf(process.env.BOT_TOKEN);

// Middleware to handle new users
bot.start(async (ctx) => {
    const userData = {
        id: ctx.from.id,
        username: ctx.from.username,
        first_name: ctx.from.first_name,
        last_name: ctx.from.last_name,
    };

    const existingUser = await User.findOne({ id: userData.id });
    if (!existingUser) {
        const newUser = new User(userData);
        await newUser.save();
        console.log('New user added:', userData);
        ctx.reply(`Welcome, ${ctx.from.first_name}! You have been added to the user list.`);
    } else {
        ctx.reply(`Welcome back, ${ctx.from.first_name}!`);
    }
});

// Command to list all users (for testing)
bot.command('listusers', async (ctx) => {
    const users = await User.find({});
    if (users.length > 0) {
        const userList = users.map(user => `${user.first_name} (${user.username})`).join('\n');
        ctx.reply(`Registered Users:\n${userList}`);
    } else {
        ctx.reply('No users found.');
    }
});

// Launch the bot once at startup
bot.launch().then(() => {
    console.log('Bot is running...');
}).catch((err) => {
    console.error('Error launching the bot:', err);
});

// Handle graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// Next.js setup
const app = next({ dev: process.env.NODE_ENV !== 'production' });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    const express = require('express');
    const server = express();

    server.all('*', (req, res) => {
        return handle(req, res);
    });

    server.listen(3000, (err) => {
        if (err) throw err;
        console.log('> Ready on http://localhost:3000');
    });
});
