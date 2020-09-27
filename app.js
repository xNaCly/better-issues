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

function log(endpoint, type, query, time) {
	console.log(`[${new Date().toTimeString().slice(0, 8)}] ${endpoint} [${type}] ${JSON.stringify(query)} | ${time}`);
}

async function rendertext(type, issue_object) {
	try {
		var { number, title, body, user, labels, state, created_at, html_url } = issue_object;
		if (type == "compact") {
			created_at = new Date(created_at).toUTCString().slice(5, 11).replace(" ", ". ");
			html_url = html_url.split("github.com")[1].split("/issues")[0].slice(1);

			let text_param = `#${number} opened on ${created_at} by ${user.login}`;
			const browser = await puppeteer.launch({
				args: ["--no-sandbox", "--disable-setuid-sandbox"],
			});
			const page = await browser.newPage();

			await page.goto(
				`file:///${__dirname}/html/compact.html?title=${encodeURIComponent(title)}&text=${encodeURIComponent(
					text_param
				)}&state=${state}&url=${encodeURIComponent(html_url)}`
			);

			await page.addStyleTag({ path: __dirname + "/html/style.css" });
			await page.setViewport({ width: 420, height: 120 });
			let image = await page.screenshot({ fullPage: true });

			await browser.close();
			return image;
		} else {
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

			//replace commit url with first 7 chars like its done in githubissues
			let commits = body.match(/(https:\/\/github.com\/.*\/.*\/commit\/)(.*)/g);
			if (commits) {
				for (commit of commits) {
					body = body.replace(commit, `\`${commit.split("/commit/")[1].slice(0, 7)}\``);
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
			const browser = await puppeteer.launch();
			const page = await browser.newPage({
				args: ["--no-sandbox", "--disable-setuid-sandbox"],
			});
			let file_default = `file:///${__dirname}/html/render.html?state=${encodeURIComponent(
				state
			)}&header=${encodeURIComponent(title_text)}&info=${encodeURIComponent(info_text)}&text=${encodeURIComponent(
				md.render(body)
			)}&url=${encodeURIComponent(url)}`;
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
		}
	} catch (e) {
		throw "issue not found" + e;
	}
}

app.get("/render_issue", async (req, res) => {
	let begin_ = Date.now();
	var { issue, type } = req.query;
	if (!issue) throw "no query given";
	if (!type) type = "default";
	resp = await fetch("https://api.github.com/repos/" + issue.split("github.com/")[1]);
	issue = await resp.json();

	let image = await rendertext(type, issue);
	let ending_ = Date.now();
	log("/render_issues", "GET", req.query, (ending_ - begin_) / 1000 + "secs");
	res.writeHead(200, {
		"Content-Type": "image/png",
	});
	res.end(image);
});

app.listen(process.env.PORT || 3000, () => {
	console.log(`[${new Date().toTimeString().slice(0, 8)}] Example app listening at http://localhost:3000`);
});

app.use((err, req, res, next) => {
	return res.json({
		status: 400,
		error: err,
	});
});