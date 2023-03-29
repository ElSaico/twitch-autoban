import { promises as fs } from 'fs';

import fetch from 'node-fetch';
import dotenv from 'dotenv';
import lodash from 'lodash';
import { RefreshingAuthProvider } from '@twurple/auth';
import { ApiClient } from '@twurple/api';

dotenv.config();
const TWITCH_BOTS_URL = 'https://api.twitchinsights.net/v1/bots/all';
const BAN_REASON = 'Wir fahren, fahren, fahren auf der AutoBAN! Caught by the sweeper...';
const WHITELIST = ['streamlabs', 'streamelements', 'nightbot', 'wizebot']; // TODO a proper replacement

async function run(userId, channelName, clientId, clientSecret) {
    const data = JSON.parse(await fs.readFile(`./tokens.${userId}.json`, 'utf-8'));
    const authProvider = new RefreshingAuthProvider(
        {
            clientId,
            clientSecret,
            onRefresh: (userId, newData) => fs.writeFile(`./tokens.${userId}.json`, JSON.stringify(newData), 'utf-8')
        }
    );
    const client = new ApiClient({ authProvider });
    authProvider.addUser(userId, data);

    const botsResponse = await fetch(TWITCH_BOTS_URL);
    const botsRaw = await botsResponse.json();
    const bots = lodash.unzip(botsRaw.bots)[0];

    const channel = await client.users.getUserByName(channelName);
    const chatters = await client.chat.getChatters(channel.id, userId);
    chatters.data.forEach(async chatter => { // TODO handle pagination
        if (bots.indexOf(chatter.userName) >= 0) {
            if (WHITELIST.indexOf(chatter.userName) >= 0) {
                console.log("Found bot %s on chat - but it's whitelisted", chatter.userDisplayName);
            } else {
                console.log("Found bot %s on chat - BAN!", chatter.userDisplayName);
                client.moderation.banUser(channel.id, userId, { user: chatter.userId, reason: BAN_REASON });
            }
        }
    });
}

const channel = process.argv[2];
if (channel === undefined) {
    console.error("Need a channel name!");
    process.exit(1);
}
run(process.env.USER_ID, channel, process.env.CLIENT_ID, process.env.CLIENT_SECRET);