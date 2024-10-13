import { Telegraf } from 'telegraf';
import mongoose from 'mongoose';

// MongoDB connection URI and bot token from environment variables
const mongoURI = process.env.MONGODB_URI;
const botToken = process.env.BOT_TOKEN;

// Connect to MongoDB
mongoose.connect(mongoURI)
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => console.error('MongoDB connection error:', err));

// Define a schema and model for users
const userSchema = new mongoose.Schema({
    id: { type: Number, unique: true },
    username: String,
    first_name: String,
    last_name: String,
});

// Avoid OverwriteModelError by checking if the model exists
const User = mongoose.models.User || mongoose.model('User', userSchema);

// Initialize the bot with your token
const bot = new Telegraf(botToken);

// Middleware to handle new users
bot.start(async (ctx) => {
    const userData = {
        id: ctx.from.id,
        username: ctx.from.username,
        first_name: ctx.from.first_name,
        last_name: ctx.from.last_name,
    };

    // Check if the user already exists
    const existingUser = await User.findOne({ id: userData.id });
    if (!existingUser) {
        // Save the new user to the database
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

// Help Command
bot.command('help', (ctx) => {
    ctx.reply(`Available commands:\n/start - Start the bot\n/listusers - List all registered users\n/help - Show this help message\n/echo [message] - Echo back the message you send\n/broadcast [message] - Send a message to all users`);
});

// Echo Functionality
bot.command('echo', (ctx) => {
    const message = ctx.message.text.split(' ').slice(1).join(' ');
    if (message) {
        ctx.reply(message);
    } else {
        ctx.reply('Please provide a message to echo. Usage: /echo [your message]');
    }
});

// Broadcast Functionality
bot.command('broadcast', async (ctx) => {
    const message = ctx.message.text.split(' ').slice(1).join(' ');
    if (!message) {
        return ctx.reply('Please provide a message to broadcast. Usage: /broadcast [your message]');
    }

    const users = await User.find({});
    if (users.length === 0) {
        return ctx.reply('No users to send the message to.');
    }

    // Send message to all users
    users.forEach(async (user) => {
        try {
            await bot.telegram.sendMessage(user.id, message);
        } catch (error) {
            console.error(`Failed to send message to user ${user.id}:`, error);
        }
    });

    ctx.reply('Message sent to all registered users.');
});

// Export a function to handle requests
export default async function handler(req, res) {
    if (req.method === 'POST') {
        try {
            await bot.launch();  // Launch the bot only on a POST request
            return res.status(200).json({ message: 'Bot is running!' });
        } catch (error) {
            console.error('Error launching the bot:', error);
            return res.status(500).json({ error: 'Failed to launch the bot.' });
        }
    } else {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}

// Handle graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
