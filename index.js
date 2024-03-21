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
function getPostsOnPage(page) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        logger_1.default.Info("Getting posts from page");
        const elements = yield page.$$(".thing");
        let posts = [];
        for (const element of elements) {
            const id = yield element.getAttribute("data-fullname");
            const subreddit = yield element.getAttribute("data-subreddit-prefixed");
            const time = yield element.$("time");
            const datetimeAttribute = (_a = yield (time === null || time === void 0 ? void 0 : time.getAttribute("datetime"))) !== null && _a !== void 0 ? _a : null;
            if (datetimeAttribute === null) {
                continue;
            }
            const timestamp = Date.parse(datetimeAttribute);
            const author = yield element.$eval(".author", (el) => el.textContent);
            const url = yield element.$eval("a.comments", (el) => el.getAttribute("href"));
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
        logger_1.default.Info("connected"); // Using the logger module
        let hour = 1000 * 60 * 60;
        let now = Date.now();
        let cutoff = now - 24 * hour; // 24hrs before the start of the script
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
        logger_1.default.Info(`Found ${posts.length} posts`);
        yield browser.close();
    });
}
// Check if the script is executed directly
if (require.main === module) {
    main();
}
