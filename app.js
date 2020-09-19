const express = require("express");
require("express-async-errors");
const app = express();
const puppeteer = require("puppeteer");

const fetch = require("node-fetch");

const markdownit = require("markdown-it");
var taskLists = require("markdown-it-task-lists");
const md = markdownit();
md.use(taskLists, { enabled: true });

const fs = require("fs");
const file_default = fs.readFileSync(__dirname + "/html/render.html");
const file_compact = fs.readFileSync(__dirname + "/html/compact.html");

async function rendertext(type, issue_object) {
	var { number, title, body, user, labels, state, created_at, html_url } = issue_object;
	if (type == "compact") {
		created_at = new Date(created_at).toUTCString().slice(5, 11).replace(" ", ". ");
		content = file_compact.toString().replace("&nbsp;SAMPLE_TITLE", `&nbsp;${title}`);
		content = content.replace("SAMPLE_TEXT", `#${number} opened on ${created_at} by ${user.login}`);
		content = content.replace("REPO_URL", `${html_url.split("github.com")[1].split("/issues")[0].slice(1)}`);
		if (state == "closed") {
			content = content.replace("default_class_closed", "span_closed_compact");
		} else if (state == "open") {
			content = content.replace("default_class_opened", "span_opened_compact");
		}
		const browser = await puppeteer.launch();
		const page = await browser.newPage();
		await page.setContent(content);
		await page.addStyleTag({ path: __dirname + "/html/style.css" });
		// await page.addStyleTag({
		// 	url: "https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/4.0.0/github-markdown.min.css",
		// });
		await page.setViewport({ width: 420, height: 120 });
		let image = await page.screenshot({ fullPage: true });

		await browser.close();
		return image;
	} else {
		/*|--> DONE DONT CHANGE <--|*/
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
		created_at = new Date(created_at).toUTCString().slice(5, 11).replace(" ", ". ");

		let commits = body.match(/(https:\/\/github.com\/.*\/.*\/commit\/)(.*)/g);
		if (commits) {
			for (commit of commits) {
				body = body.replace(commit, `\`${commit.split("/commit/")[1].slice(0, 7)}\``);
			}
		}
		let strike = body.match(/~(.*?)~/g);
		if (strike) {
			for (text of strike) {
				body = body.replace(text, `<s>${text.replace("~", "")}</s>`);
			}
		}
		let content = file_default.toString().replace("SAMPLE_TEXT", md.render(body));
		content = content.replace("SAMPLE_HEADER", `<h3>${title} [<a href="#">#${number}</a>]:</h3><h4>`);
		content = content.replace("SAMPLE_INFO", `${user.login} opened this issue on ${created_at}</h4>\n\n`);

		if (state == "closed") {
			content = content.replace("default_class_closed", "span_closed_issue");
		} else if (state == "open") {
			content = content.replace("default_class_opened", "span_opened_issue");
		}

		const browser = await puppeteer.launch();
		const page = await browser.newPage();
		await page.setContent(content);
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
	}
}

app.get("/render_issue", async (req, res) => {
	var { issue, type } = req.query;
	if (!issue) throw "no query given";
	if (!type) type = "default";
	resp = await fetch("https://api.github.com/repos/" + issue.split("github.com/")[1]);
	issue = await resp.json();

	let image = await rendertext(type, issue);
	res.writeHead(200, {
		"Content-Type": "image/png",
	});
	res.end(image);
});

app.listen("3000", () => {
	console.log(`[${new Date().toTimeString().slice(0, 8)}] Example app listening at http://localhost:3000`);
});

// app.use((err, req, res, next) => {
// 	return res.json({
// 		status: 400,
// 		error: err,
// 	});
// });
