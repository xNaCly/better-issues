const express = require("express");
require("express-async-errors");
const app = express();

const puppeteer = require("puppeteer");
const markdownit = require("markdown-it");
const taskLists = require("markdown-it-task-lists");

const fetch = require("node-fetch");

const md = markdownit();
md.use(taskLists, { enabled: true });

function log(endpoint, type, query, time) {
	console.log(
		`[${new Date()
			.toTimeString()
			.slice(0, 8)}] ${endpoint} [${type}] ${JSON.stringify(
			query
		)} | ${time}`
	);
}

async function renderIssue(type, issue_object) {
	try {
		let { number, title, body, user, labels, state, created_at, html_url } =
			issue_object;

		if (type == "compact") {
			created_at = new Date(created_at)
				.toUTCString()
				.slice(5, 11)
				.replace(" ", ". ");
			html_url = html_url
				.split("github.com")[1]
				.split("/issues")[0]
				.slice(1);

			let text_param = `#${number} opened on ${created_at} by ${user.login}`;
			const browser = await puppeteer.launch({
				args: ["--no-sandbox", "--disable-setuid-sandbox"],
			});
			const page = await browser.newPage();

			await page.goto(
				`file:///${__dirname}/html/compact.html?title=${encodeURIComponent(
					title
				)}&text=${encodeURIComponent(
					text_param
				)}&state=${state}&url=${encodeURIComponent(html_url)}`
			);

			await page.addStyleTag({ path: __dirname + "/html/style.css" });
			await page.setViewport({
				width: 420,
				height: 120,
				deviceScaleFactor: 2,
			});
			let image = await page.screenshot({ fullPage: true });

			await browser.close();
			return image;
		}

		md.configure({
			options: {
				html: true,
				xhtmlOut: true,
				breaks: true,
				langPrefix: "language-",
				linkify: true,
				typographer: true,
				maxNesting: 100,
			},
		});

		created_at = new Date(created_at)
			.toUTCString()
			.slice(5, 11)
			.replace(" ", ". ");

		//replace commit url with first 7 chars like its done in githubissues
		let commits = body.match(
			/(https:\/\/github.com\/.*\/.*\/commit\/)(.*)/g
		);
		if (commits) {
			for (commit of commits) {
				body = body.replace(
					commit,
					`\`${commit.split("/commit/")[1].slice(0, 7)}\``
				);
			}
		}

		// md = ~texttostrike~ //html = <s>texttostrike</s>
		let strike = body.match(/~(.*?)~/g);
		if (strike) {
			for (text of strike) {
				body = body.replace(text, `<s>${text.replace("~", "")}</s>`);
			}
		}

		let title_text = `<h3 id="title_text">${title} [<a href="#">#${number}</a>]:</h3>`;
		let info_text = `${user.login} opened this issue on ${created_at}\n\n`;

		let url = html_url.split("github.com")[1].split("/issues")[0].slice(1);

		const browser = await puppeteer.launch({
			args: ["--no-sandbox", "--disable-setuid-sandbox"],
		});

		const page = await browser.newPage();

		let file_default = `file:///${__dirname}/html/render.html?state=${encodeURIComponent(
			state
		)}&header=${encodeURIComponent(title_text)}&info=${encodeURIComponent(
			info_text
		)}&text=${encodeURIComponent(md.render(body))}&url=${encodeURIComponent(
			url
		)}`;

		await page.goto(file_default);
		await page.addStyleTag({ path: __dirname + "/html/style.css" });

		await page.addStyleTag({
			url: "https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/4.0.0/github-markdown.min.css",
		});

		await page.addStyleTag({
			content: "@page { size: auto; }",
		});

		let image = await page.screenshot({ fullPage: true });

		await browser.close();
		return image;
	} catch (e) {
		throw "issue not found" + e;
	}
}

async function renderReadme(readme_content, density) {
	try {
		md.configure({
			options: {
				html: true,
				xhtmlOut: true,
				breaks: true,
				langPrefix: "language-",
				linkify: true,
				typographer: true,
				maxNesting: 100,
			},
		});

		// md = ~texttostrike~ //html = <s>texttostrike</s>
		let strike = readme_content.match(/~(.*?)~/g);
		if (strike) {
			for (text of strike) {
				readme_content = readme_content.replace(
					text,
					`<s>${text.replace("~", "")}</s>`
				);
			}
		}

		const browser = await puppeteer.launch({
			// options: {
			// 	defaultViewport: {
			// 		deviceScaleFactor: 3,
			// 	},
			// },
			args: ["--no-sandbox", "--disable-setuid-sandbox"],
		});

		const page = await browser.newPage();

		let file_default = `file:///${__dirname}/html/readme.html?content=${encodeURIComponent(
			md.render(readme_content)
		)}`;

		await page.goto(file_default);
		await page.addStyleTag({ path: __dirname + "/html/style.css" });

		await page.addStyleTag({
			url: "https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/4.0.0/github-markdown.min.css",
		});

		await page.addStyleTag({
			content: "@page { size: auto; }",
		});

		let image = await page.screenshot({ fullPage: true });

		await browser.close();
		return image;
	} catch (e) {
		throw "readme not found" + e;
	}
}

app.get("/render_issue", async (req, res) => {
	const begin = Date.now();
	let { issue, type } = req.query;
	if (!issue) throw "no issue link given";

	const resp = await fetch(
		"https://api.github.com/repos/" + issue.split("github.com/")[1]
	);
	issue = await resp.json();

	const image = await renderIssue(type, issue);
	const ending = Date.now();

	log("/render_issues", "GET", req.query, (ending - begin) / 1000 + "secs");

	res.writeHead(200, {
		"Content-Type": "image/png",
		"Cache-Control": "no-cache",
	});
	res.end(image);
});

app.get("/render_readme", async (req, res) => {
	const begin = Date.now();
	let { link } = req.query;
	if (!link) throw "no repo link given";

	const resp = await fetch(
		link
			.replace("github.com", "raw.githubusercontent.com")
			.replace("blob/", "")
	);
	readme = await resp.text();

	const image = await renderReadme(readme);
	const ending = Date.now();

	log("/render_readme", "GET", req.query, (ending - begin) / 1000 + "secs");

	res.writeHead(200, {
		"Content-Type": "image/png",
		"Cache-Control": "no-cache",
	});
	res.end(image);
});

app.listen(process.env.PORT || 3000, () => {
	console.log("Api started...");
});

app.use((err, req, res, next) => {
	return res.json({
		status: 400,
		error: err,
	});
});
