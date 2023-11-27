import { App, GenericMessageEvent } from "@slack/bolt";

export type IncomingMessage = {
    messageId: string;
    channel: string;
    threadId?: string;
    raw: string;
    message: string;
}

export type OutgoingMessage = {
    channel: string;
    threadId?: string;
    data: string | Buffer;
    dataType: 'text'|'image';
}

export type Reactions = {
    loading?: string;
    success?: string;
    failed?: string;
}

export interface SlackBotArgs {
    slackBotToken: string;
    slackAppToken: string;
    botUserId: string;
    reactions?: Reactions;
}

export interface SlackListenArgs {
    command?: boolean,
    mention?: boolean,
    directMessage?: boolean,
}

export type CommandHook = {
    isSync: boolean;
    dataType: 'text'|'image';
    handler: (message: IncomingMessage) => Promise<string|Buffer>;
}

export class SlackBridge {

    private slackApp: App;
    private reactions: Reactions;
    private commandHook?: CommandHook;
    private botUserId: string;

    constructor(args: SlackBotArgs) {

        this.slackApp = new App({
            token: args.slackBotToken,
            appToken: args.slackAppToken,
            socketMode: true
        });

        this.botUserId = args.botUserId;

        this.reactions = {
            loading: args.reactions?.loading || 'thinking_face',
            success: args.reactions?.success || 'white_check_mark',
            failed: args.reactions?.failed || 'x'
        };
    }

    registerHandler(hook: CommandHook) {
        this.commandHook = hook;
    }

    async postMessage(message: OutgoingMessage) {
        if (message.dataType === 'image' && Buffer.isBuffer(message.data)) {
            await this.slackApp.client.filesUploadV2({
                channel_id: message.channel,
                thread_ts: message.threadId,
                file: message.data,
                filename: 'data.png',
            });

        } else if (message.dataType === 'text' && typeof message.data === 'string') {
            await this.slackApp.client.chat.postMessage({
                channel: message.channel,
                thread_ts: message.threadId,
                text: message.data,
            });
        }
        
    }

    async processMessage(incomingMessage: IncomingMessage) {
        console.log(`[${new Date().toISOString()}] SLACK_PROCESS_MESSAGE ${JSON.stringify(incomingMessage)}`);

        if (!this.commandHook) {
            return;
        }

        if (this.reactions.loading) {
            const reaction = await this.slackApp.client.reactions.add({ 
                channel: incomingMessage.channel, 
                name: this.reactions.loading, 
                timestamp: incomingMessage.messageId 
            });
        }

        try {
            if (this.commandHook.isSync) {
                const message = await this.commandHook.handler(incomingMessage);
                if (message) {
                    await this.postMessage({
                        dataType: this.commandHook.dataType,
                        channel: incomingMessage.channel, 
                        threadId: incomingMessage.messageId, 
                        data: message,
                    });
                }
            }
        } catch (err) {
            console.error(err);
            if (this.reactions.failed) {
                await this.slackApp.client.reactions.add({ 
                    channel: incomingMessage.channel, 
                    name: this.reactions.failed, 
                    timestamp: incomingMessage.messageId,
                });
            }
            await this.postMessage({
                dataType: this.commandHook.dataType,
                channel: incomingMessage.channel, 
                threadId: incomingMessage.messageId, 
                data: `Sorry, something went wrong. (${(err instanceof Error) ? err.message : ''})`,
            });

        } finally {

            if (this.reactions.loading) {
                await this.slackApp.client.reactions.remove({ 
                    channel: incomingMessage.channel, 
                    name: this.reactions.loading, 
                    timestamp: incomingMessage.messageId,
                });
            }
        }

    }

    async listen(listenArgs: SlackListenArgs) {

        console.info(`[${new Date().toISOString()}] SLACK_START_LISTENING ${JSON.stringify(listenArgs)}`);

        if (listenArgs.directMessage) {
            this.slackApp.message(async ({ message }) => {
                console.info(`[${new Date().toISOString()}] SLACK_RECEIVED_DIRECT_MESSAGE ${JSON.stringify(message)}`);
                const { ts, thread_ts, channel, text } = <GenericMessageEvent>message;
                if (!text) {
                    return;
                }
    
                await this.processMessage({
                    messageId: ts,
                    channel,
                    threadId: thread_ts,
                    raw: text,
                    message: text,
                });
            });
        }
        
        if (listenArgs.mention) {
            this.slackApp.event('app_mention', async ({ event }) => {
    
                console.info(`[${new Date().toISOString()}] SLACK_RECEIVED_MENTION ${JSON.stringify(event)}`);
        
                const userIdTag = `<@${this.botUserId}>`;
                const { text, ts, channel, thread_ts } = event;
                console.log(text, userIdTag);
                if (!text.includes(userIdTag)) {
                    return;
                }
    
                await this.processMessage({
                    messageId: ts,
                    channel,
                    threadId: thread_ts,
                    raw: text,
                    message: text.replace(userIdTag, '').trim(),
                });
            });
        }
    
        
        await this.slackApp.start();
    }
}