import { Page, chromium } from 'playwright';
import logger from './logger'; // Adjust the path as necessary

async function getPostsOnPage(page: Page) : Promise<any[]> {
    logger.Info("Getting posts from page");
    const elements = await page.$$(".thing");

    let posts: any[] = [];

    for(const element of elements) {
        const id = await element.getAttribute("data-fullname");
        const subreddit = await element.getAttribute("data-subreddit-prefixed");

        const time = await element.$("time");
        const datetimeAttribute = await time?.getAttribute("datetime") ?? null;

        if (datetimeAttribute === null) {
            continue;
        }

        const timestamp = Date.parse(datetimeAttribute);
        const author = await element.$eval(".author", (el) => el.textContent);
        const url = await element.$eval("a.comments", (el) => el.getAttribute("href"));

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
    logger.Info("connected"); // Using the logger module

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

    logger.Info(`Found ${posts.length} posts`);


    await browser.close();
}

// Check if the script is executed directly
if (require.main === module) {
    main();
}
