import { ElementHandle, Page, chromium } from 'playwright';
import logger from './logger'; // Adjust the path as necessary

async function parseComment(e: ElementHandle<HTMLElement | SVGElement> | null) {
    const things = await e?.$$("> .sitetable > .thing");

    let comments: any[] = [];
    if (things) {
        for (const thing of things) {
            let thingClass = await thing.getAttribute("class");
            let children = await parseComment(await thing?.$(".child")); // Add ? before calling .$
            let isCollapsed = thingClass?.includes("collapsed");
            let isDeleted = thingClass?.includes("deleted");
            let author = isDeleted ? "" : await thing?.getAttribute("data-author");

            //let time = await thing.$eval("time", (el) => el.getAttribute("datetime"));

            let time = "";
            const timeElement = await thing?.$("time");
            if (timeElement) {
                time = await timeElement.getAttribute("datetime") || "";
            }

            let comment = isDeleted || isCollapsed ? "" : await thing.$eval("div.md", (el) => el.textContent?.trim());
            let points = isDeleted || isCollapsed ? "" : await thing.$eval("span.score", (el) => el.textContent?.trim());

            comments.push({ author, time, comment, points, children, isDeleted, isCollapsed });
        }
    }

    return comments;
}


async function getPostdata({ page, post }: { page: Page; post: any }) {
    logger.info("Getting detials for post", { post: post});

    await page.goto(post.url);

    const sitetable = await page.$("div.sitetable");
    const thing = await sitetable?.$(".thing");

    let id = post.id;
    let subreddit = post.subreddit;
    let dataType = await thing?.getAttribute("data-type"); // Corrected line
    let dataURL = await thing?.getAttribute("data-url");
    let isPromoted = (await thing?.getAttribute("data-promoted")) === "true";
    let isGallery = (await thing?.getAttribute("data-gallery")) === "true";

    //let title = await page.$eval("a.title", (el) => el.textContent);
    let title = await page.$eval('title', (element) => element.textContent);
    
    let pointsElement = await sitetable?.$(".score.unvoted");
    let points = pointsElement ? parseInt(await pointsElement.innerText()) : 0;

    let textElement = await sitetable?.$("div.usertext-body");
    let text = textElement ? await textElement.innerText() : "";

    var moo = await page.$("div.commentarea");

    let comments = await parseComment(await page.$("div.commentarea"));

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
}

async function getPostsOnPage(page: Page) : Promise<any[]> {
    logger.info(`Getting posts from page: ${page.url()}`);
    const elements = await page.$$(".thing");

    let posts: any[] = [];

    for(const element of elements) {
        const id = await element.getAttribute("data-fullname");
        const subreddit = await element.getAttribute("data-subreddit-prefixed");

        const time = await element.getAttribute("data-timestamp");

        if (time === null) {
            continue;
        }

        const timestamp = new Date(time);
        const author = await element.getAttribute("data-author");
        const url = `https://old.reddit.com${await element.getAttribute("data-permalink")}`;

        posts.push({ id, subreddit, timestamp, author, url });

    }

    return posts;
}


async function main() {
    const browser = await chromium.launch({
        headless: false
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("https://old.reddit.com/r/programming/new/");
    logger.info("connected"); // Using the logger module

    let hour = 1000 * 60 * 60;

    let now = Date.now();
    let cutoff = now - 24 * hour; // 24hrs before the start of the script
    let earliest = Date.now();
    
    let posts: any[] = [];
    
    while (cutoff < earliest) {
        let pagePosts = await getPostsOnPage(page);
        if (pagePosts.length == 0){
            break;
        }

        posts = posts.concat(pagePosts);
        let earliestPost = posts[posts.length - 1];
        earliest = earliestPost.timestamp;

        if (earliestPost.timestamp < cutoff) {
            break;
        }

        let nextPageUrl = await page.$eval(".next-button a", (el: Element) => (el as HTMLAnchorElement).href);
        await page.goto(nextPageUrl);

    }

    // posts = posts.filter((post) => post.timestamp > cutoff); // Remove any older than 24 hours
    let data: any[] = [];

    for (const post of posts) {
        let postData = await getPostdata({ post, page });
        data.push(postData);
    }


    logger.info(`Found ${posts.length} posts`);


    await browser.close();
}

// Check if the script is executed directly
if (require.main === module) {
    main();
}
