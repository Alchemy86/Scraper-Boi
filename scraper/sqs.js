"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_sqs_1 = require("@aws-sdk/client-sqs");
const client = new client_sqs_1.SQSClient({ region: "eu-west-2" });
const queueURL = process.env.QUEUE_URL;
function publishChunk(chunk) {
    return __awaiter(this, void 0, void 0, function* () {
        const command = new client_sqs_1.SendMessageBatchCommand({
            QueueUrl: queueURL,
            Entries: chunk
        });
        yield client.send(command);
    });
}
const queue = {
    publish: function (posts) {
        return __awaiter(this, void 0, void 0, function* () {
            const msgs = posts.map((post) => ({
                Id: post.id,
                MessageBody: JSON.stringify(post)
            }));
            const chunkSize = 10;
            for (let i = 0; i < msgs.length; i += chunkSize) {
                let chunk = msgs.slice(i, i + chunkSize);
                yield publishChunk(chunk);
            }
        });
    }
};
exports.default = queue;
