import { promises as fs } from 'fs';

import fetch from 'node-fetch';
import dotenv from 'dotenv';
import lodash from 'lodash';
import { RefreshingAuthProvider } from '@twurple/auth';
import { ChatClient } from '@twurple/chat';

dotenv.config();
const TWITCH_BOTS_URL = 'https://api.twitchinsights.net/v1/bots/online';
const BAN_REASON = 'Wir fahren, fahren, fahren auf der AutoBAN! Caught by the sweeper...';

async function run(channel, clientId, clientSecret) {
    const data = JSON.parse(await fs.readFile('./tokens.json', 'utf-8'));
    const auth = new RefreshingAuthProvider(
        {
            clientId,
            clientSecret,
            onRefresh: newData => fs.writeFile('./tokens.json', JSON.stringify(newData), 'utf-8')
        },
        data
    );
    const client = new ChatClient({
        authProvider: auth,
        channels: [channel],
        requestMembershipEvents: true
    });

    let mods;
    const botsResponse = await fetch(TWITCH_BOTS_URL);
    const botsRaw = await botsResponse.json();
    const bots = lodash.unzip(botsRaw.bots)[0];
    client.onJoin(async (channel, user) => {
        if (user === client.currentNick) {
            mods = await client.getMods(channel);
        } else if (bots.indexOf(user) >= 0) {
            if (mods.indexOf(user) >= 0) {
                console.log("Found bot %s on chat - but it's a mod", user);
            } else {
                console.log("Found bot %s on chat - BAN!", user);
                client.ban(channel, user, BAN_REASON);
            }
        }
    });

    await client.connect();
    setTimeout(() => {
        client.quit();
    }, 60000);
}

const channel = process.argv[2];
if (channel === undefined) {
    console.error("Need a channel name!");
    process.exit(1);
}
run(channel, process.env.CLIENT_ID, process.env.CLIENT_SECRET);