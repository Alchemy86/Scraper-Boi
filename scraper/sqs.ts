import { SQSClient, SendMessageBatchCommand } from "@aws-sdk/client-sqs";

const client = new SQSClient({ region: "eu-west-2" })
const queueURL = process.env.QUEUE_URL;

async function publishChunk(chunk : any[]) {
    const command = new SendMessageBatchCommand({
        QueueUrl: queueURL,
        Entries: chunk
    });

    await client.send(command);
}

const queue = {
    publish: async function (posts: any[]) {
        const msgs = posts.map((post) => ({
            Id: post.id,
            MessageBody: JSON.stringify(post)
        }));

        const chunkSize = 10;
        for(let i=0; i < msgs.length; i += chunkSize){
            let chunk = msgs.slice(i, i+chunkSize);
            await publishChunk(chunk);
        }
    }
};

export default queue;