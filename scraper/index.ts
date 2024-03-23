import { ElementHandle, Page, chromium } from 'playwright';
import logger from './logger'; // Adjust the path as necessary
import queue from './sqs';
import { APIGatewayProxyEvent, Context, APIGatewayProxyResult } from 'aws-lambda'; // Import types from aws-lambda package


interface AttributeMap {
    [key: string]: string;
  }

const addPageInterceptors = async (page : Page) => {
    await page.route("**/*", (route)=> {
        const request = route.request();
        const resourceType = request.resourceType();
        if (
            resourceType === "image" ||
            resourceType === "font" ||
            resourceType === "stlyesheet" ||
            resourceType === "script" ||
            resourceType === "media" ||
            resourceType === "image"
        ){
            route.abort();
        } else{
            route.continue();
        }
    });
}

const getAttributes = async (handle: ElementHandle<HTMLElement | SVGElement> | null | undefined) =>
  handle?.evaluate((element: HTMLElement) => {
    const attributeMap: AttributeMap = {};
    for (const attr of element.attributes) {
      attributeMap[attr.name] = attr.value;
    }
    return attributeMap;
  });

async function getdataForPosts(posts: any[]) : Promise<any[]>{
    return await Promise.all(
        posts.map(async (post) => {
            const browser = await chromium.launch({
                headless: false
            });
        
            const context = await browser.newContext();
            const page = await context.newPage();
            addPageInterceptors(page);

            const data = await getPostdata({ page, post });
            await browser.close();
            return data;
        })
    )
}

async function parseComment(e: ElementHandle<HTMLElement | SVGElement> | null) {
    const things = await e?.$$("> .sitetable > .thing");

    let comments: any[] = [];
    if (things) {
        for (const thing of things) {
            const attributes = await getAttributes(thing);
            if (!attributes){
                return;
            }
            let thingClass = attributes["class"];
            let children = await parseComment(await thing?.$(".child")); // Add ? before calling .$
            let isCollapsed = thingClass?.includes("collapsed");
            let isDeleted = thingClass?.includes("deleted");
            let author = isDeleted ? "" : attributes["data-author"];

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

    const attributes = await getAttributes(thing);

    if(!attributes){
        return;
    }

    let dataType = attributes["data-type"];
    let dataURL = attributes["data-url"];
    let isPromoted = attributes["data-promoted"] === "true";
    let isGallery = attributes["data-gallery"] === "true";

    //let title = await page.$eval("a.title", (el) => el.textContent);
    let title = await page.$eval('title', (element) => element.textContent);
    
    let pointsElement = await sitetable?.$(".score.unvoted");
    let points = pointsElement ? parseInt(await pointsElement.innerText()) : 0;

    let textElement = await sitetable?.$("div.usertext-body");
    let text = textElement ? await textElement.innerText() : "";

    let comments: any[] = [];
    try {
        const commentArea = await page.$("div.commentarea");
        if (commentArea) {
            const parsedComments = await parseComment(commentArea);
            if (parsedComments) {
                comments = parsedComments;
            }
        }
    } catch (e) {
        logger.error("error parsing comments", { error: e });
    }
    

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
        points,
        text,
        comments
    };
}

async function getPostsOnPage(page: Page) : Promise<any[]> {
    logger.info(`Getting posts from page: ${page.url()}`);
    const elements = await page.$$(".thing");

    let posts: any[] = [];

    for(const element of elements) {
        const attributes = await getAttributes(element);
        if(!attributes){
            continue;
        }

        const id = attributes["data-fullname"];
        const subreddit = attributes["data-subreddit-prefixed"];

        const time = attributes["data-timestamp"];

        if (time === null) {
            continue;
        }

        const timestamp = new Date(time);
        const author = attributes["data-author"];
        const url = `https://old.reddit.com${attributes["data-permalink"]}`;

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
    addPageInterceptors(page);

    await page.goto("https://old.reddit.com/r/programming/new/");
    logger.info("connected"); // Using the logger module

    let hour = 1000 * 60 * 60;

    let now = Date.now();
    let cutoff = now - (24 * hour); // 24hrs before the start of the script
    let earliest = Date.now();
    
    let posts: any[] = [];
    
    while (cutoff < earliest) {
        let pagePosts = await getPostsOnPage(page);browser
        browser
        browser
        browser
        browser
        browser
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

    const data = await getdataForPosts(posts);

    const nowStr = new Date().toISOString();

    // Log data to the queue for processing
    var dataToLog = data.map((post) => ({ ...post, scrapedAt: nowStr }));
    await queue.publish(dataToLog);

    logger.info(`Found ${posts.length} posts`);

    await browser.close();
}

// Check if the script is executed directly
if (require.main === module) {
    main();
}

// aws register
exports.handler = async function (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {
    try {
        await main();
    } catch (e) {
        // Catch all errors so that the function doesn't retry
        console.log(e);
        logger.error("error scraping", { error: e });
        return { statusCode: 500, body: JSON.stringify({ success: false }) }; // Returning APIGatewayProxyResult
    }
    return { statusCode: 200, body: JSON.stringify({ success: true }) }; // Returning APIGatewayProxyResult
};
