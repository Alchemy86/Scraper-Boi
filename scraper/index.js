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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const playwright_1 = require("playwright");
const logger_1 = __importDefault(require("./logger")); // Adjust the path as necessary
const sqs_1 = __importDefault(require("./sqs"));
function parseComment(e) {
    return __awaiter(this, void 0, void 0, function* () {
        const things = yield (e === null || e === void 0 ? void 0 : e.$$("> .sitetable > .thing"));
        let comments = [];
        if (things) {
            for (const thing of things) {
                let thingClass = yield thing.getAttribute("class");
                let children = yield parseComment(yield (thing === null || thing === void 0 ? void 0 : thing.$(".child"))); // Add ? before calling .$
                let isCollapsed = thingClass === null || thingClass === void 0 ? void 0 : thingClass.includes("collapsed");
                let isDeleted = thingClass === null || thingClass === void 0 ? void 0 : thingClass.includes("deleted");
                let author = isDeleted ? "" : yield (thing === null || thing === void 0 ? void 0 : thing.getAttribute("data-author"));
                //let time = await thing.$eval("time", (el) => el.getAttribute("datetime"));
                let time = "";
                const timeElement = yield (thing === null || thing === void 0 ? void 0 : thing.$("time"));
                if (timeElement) {
                    time = (yield timeElement.getAttribute("datetime")) || "";
                }
                let comment = isDeleted || isCollapsed ? "" : yield thing.$eval("div.md", (el) => { var _a; return (_a = el.textContent) === null || _a === void 0 ? void 0 : _a.trim(); });
                let points = isDeleted || isCollapsed ? "" : yield thing.$eval("span.score", (el) => { var _a; return (_a = el.textContent) === null || _a === void 0 ? void 0 : _a.trim(); });
                comments.push({ author, time, comment, points, children, isDeleted, isCollapsed });
            }
        }
        return comments;
    });
}
function getPostdata({ page, post }) {
    return __awaiter(this, void 0, void 0, function* () {
        logger_1.default.info("Getting detials for post", { post: post });
        yield page.goto(post.url);
        const sitetable = yield page.$("div.sitetable");
        const thing = yield (sitetable === null || sitetable === void 0 ? void 0 : sitetable.$(".thing"));
        let id = post.id;
        let subreddit = post.subreddit;
        let dataType = yield (thing === null || thing === void 0 ? void 0 : thing.getAttribute("data-type")); // Corrected line
        let dataURL = yield (thing === null || thing === void 0 ? void 0 : thing.getAttribute("data-url"));
        let isPromoted = (yield (thing === null || thing === void 0 ? void 0 : thing.getAttribute("data-promoted"))) === "true";
        let isGallery = (yield (thing === null || thing === void 0 ? void 0 : thing.getAttribute("data-gallery"))) === "true";
        //let title = await page.$eval("a.title", (el) => el.textContent);
        let title = yield page.$eval('title', (element) => element.textContent);
        let pointsElement = yield (sitetable === null || sitetable === void 0 ? void 0 : sitetable.$(".score.unvoted"));
        let points = pointsElement ? parseInt(yield pointsElement.innerText()) : 0;
        let textElement = yield (sitetable === null || sitetable === void 0 ? void 0 : sitetable.$("div.usertext-body"));
        let text = textElement ? yield textElement.innerText() : "";
        var moo = yield page.$("div.commentarea");
        let comments = yield parseComment(yield page.$("div.commentarea"));
        return {
            id,
            subreddit,
            dataType,
            dataURL,
            isPromoted,
            isGallery,
            title,
            timestamp: post.timestamp,
            author: post.author,
            url: post.url,
            points
        };
    });
}
function getPostsOnPage(page) {
    return __awaiter(this, void 0, void 0, function* () {
        logger_1.default.info(`Getting posts from page: ${page.url()}`);
        const elements = yield page.$$(".thing");
        let posts = [];
        for (const element of elements) {
            const id = yield element.getAttribute("data-fullname");
            const subreddit = yield element.getAttribute("data-subreddit-prefixed");
            const time = yield element.getAttribute("data-timestamp");
            if (time === null) {
                continue;
            }
            const timestamp = new Date(time);
            const author = yield element.getAttribute("data-author");
            const url = `https://old.reddit.com${yield element.getAttribute("data-permalink")}`;
            posts.push({ id, subreddit, timestamp, author, url });
        }
        return posts;
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const browser = yield playwright_1.chromium.launch({
            headless: false
        });
        const context = yield browser.newContext();
        const page = yield context.newPage();
        yield page.goto("https://old.reddit.com/r/programming/new/");
        logger_1.default.info("connected"); // Using the logger module
        let hour = 1000 * 60 * 60;
        let now = Date.now();
        let cutoff = now - (24 * hour); // 24hrs before the start of the script
        let earliest = Date.now();
        let posts = [];
        while (cutoff < earliest) {
            let pagePosts = yield getPostsOnPage(page);
            if (pagePosts.length == 0) {
                break;
            }
            posts = posts.concat(pagePosts);
            let earliestPost = posts[posts.length - 1];
            earliest = earliestPost.timestamp;
            if (earliestPost.timestamp < cutoff) {
                break;
            }
            let nextPageUrl = yield page.$eval(".next-button a", (el) => el.href);
            yield page.goto(nextPageUrl);
        }
        let data = [];
        for (const post of posts) {
            let postData = yield getPostdata({ post, page });
            data.push(postData);
        }
        const nowStr = new Date().toISOString();
        // Log data to the queue for processing
        var dataToLog = data.map((post) => (Object.assign(Object.assign({}, post), { scrapedAt: nowStr })));
        logger_1.default.info(`DATA: WE HAVE: ${data.length} ${JSON.stringify(dataToLog)}`);
        yield sqs_1.default.publish(dataToLog);
        logger_1.default.info(`Found ${posts.length} posts`);
        yield browser.close();
    });
}
// Check if the script is executed directly
if (require.main === module) {
    main();
}
