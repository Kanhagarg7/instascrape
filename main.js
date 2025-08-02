import { Actor } from 'apify';

async function scrapePostUrls(url, maxPosts, browser) {
    const page = await browser.newPage();
    console.log(`Opening ${url}`);
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    let urls = [];
    let prevHeight = 0;

    // Scroll until we get enough posts
    while (urls.length < maxPosts) {
        const newUrls = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('article a'))
                .map(a => a.href)
                .filter(href => href.includes('/p/'));
        });

        urls = [...urls, ...newUrls];
        urls = [...new Set(urls)]; // remove duplicates

        const height = await page.evaluate(() => document.body.scrollHeight);
        if (height === prevHeight) break;
        prevHeight = height;

        await page.mouse.wheel(0, 3000);
        await page.waitForTimeout(1500);
    }

    urls = urls.slice(0, maxPosts);
    await page.close();
    return urls;
}

await Actor.main(async () => {
    const input = await Actor.getInput();
    const {
        usernames = [],
        hashtags = [],
        maxPostsPerProfile = 20,
    } = input;

    if (usernames.length === 0 && hashtags.length === 0) {
        throw new Error("Please provide at least one username or hashtag.");
    }

    // Use free rotating datacenter proxies
    const proxyConfiguration = await Actor.createProxyConfiguration({
        groups: ['DATACENTER'],
    });

    const browser = await Actor.launchPlaywright({ proxyConfiguration });

    // Scrape usernames
    for (const username of usernames) {
        const postUrls = await scrapePostUrls(
            `https://www.instagram.com/${username}/`,
            maxPostsPerProfile,
            browser
        );
        for (const postUrl of postUrls) {
            await Actor.pushData({ username, postUrl });
        }
    }

    // Scrape hashtags
    for (const tag of hashtags) {
        const postUrls = await scrapePostUrls(
            `https://www.instagram.com/explore/tags/${tag}/`,
            maxPostsPerProfile,
            browser
        );
        for (const postUrl of postUrls) {
            await Actor.pushData({ hashtag: tag, postUrl });
        }
    }

    await browser.close();
});
