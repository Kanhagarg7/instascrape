import { Actor } from 'apify';

async function scrapePostUrls(url, maxPosts, browser) {
    const page = await browser.newPage();
    console.log(`Opening ${url}`);
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    let urls = [];
    let prevHeight = 0;

    while (urls.length < maxPosts) {
        const newUrls = await page.evaluate(() =>
            Array.from(document.querySelectorAll('article a'))
                .map(a => a.href)
                .filter(href => href.includes('/p/'))
        );

        urls = [...new Set([...urls, ...newUrls])];

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
    try {
        const input = await Actor.getInput() || {};
        const {
            usernames = [],
            hashtags = [],
            maxPostsPerProfile = 20,
        } = input;

        if (usernames.length === 0 && hashtags.length === 0) {
            console.log("❌ No usernames or hashtags provided in input.");
            return;
        }

        const proxyConfiguration = await Actor.createProxyConfiguration({
            groups: ['DATACENTER'],
        });

        const browser = await Actor.launchPlaywright({ proxyConfiguration });

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
    } catch (err) {
        console.error("💥 Uncaught Error:", err.message);
        console.error(err.stack);
    }
});
