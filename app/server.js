const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { chromium } = require('playwright');
const bodyParser = require('body-parser');
const sharp = require('sharp');
const session = require('express-session');

const app = express();
const upload = multer({ dest: '/temp/uploads/' });

app.use('/static', express.static(path.join(__dirname, 'static')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'templates'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const tempDir = '/temp';
const sessionFolder = path.join(tempDir, 'session');
const uploadFolder = path.join(tempDir, 'uploads');

if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

if (!fs.existsSync(sessionFolder)) {
  fs.mkdirSync(sessionFolder);
} else {
  fs.readdirSync(sessionFolder).forEach(file => {
    fs.unlinkSync(path.join(sessionFolder, file));
  });
}

if (!fs.existsSync(uploadFolder)) {
  fs.mkdirSync(uploadFolder);
}

app.use(session({
  secret: 'notsosecret',
  resave: false,
  saveUninitialized: true,
  store: new session.MemoryStore({
    checkPeriod: 86400000
  })
}));

const writeFileAsync = promisify(fs.writeFile);
const readFileAsync = promisify(fs.readFile);

const convertToPng = async (inputPath, outputPath) => {
  try {
    await sharp(inputPath)
      .png()
      .toFile(outputPath);
  } catch (error) {
    console.error(`Error converting image to PNG: ${error}`);
  }
};

const getResponse = async (filePath) => {
  console.log("Starting browser...");
  const browser = await chromium.launch({ headless: true, timeout: 10000 });
  console.log("Browser started");
  const context = await browser.newContext();
  const page = await context.newPage();
  console.log("New page created");

  try {
    await page.goto("https://gauthmath.com");
    console.log("Loaded page");
    const uploadElements = await page.$$('.UploadImage_file__Tdjhi');
    if (uploadElements.length > 0) {
      const firstUploadElement = uploadElements[0];
      await firstUploadElement.setInputFiles(filePath);
      console.log("Uploaded image");
    } else {
      console.log("No upload elements found");
    }
    console.log("Uploaded image");

    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log("Waited for 5 seconds");

    const question = await page.$('.Question_question-content__HcAVE');
    if (question) {
      console.log("Question found");

      await new Promise(resolve => setTimeout(resolve, 5000));

      const answers = await page.$$('.Card_card__Ds0Yk.CacheAnswer_answerInfo__23hl2');
      const iframeanswers = await page.$('iframe');
      const gpt35answers = await page.$('.AnswerResult_answer-result__VSKWo');
      if (answers.length >= 2) {
        console.log("Answer elements found");
        const answer = answers[1];
        const screenshotBytes = await answer.screenshot();
        console.log("Screenshot taken");
        return [screenshotBytes.toString('base64')];
      } else if (iframeanswers) {
        console.log("Iframe answer elements found");
        const frame = await iframeanswers.contentFrame();
        const answer = await frame.$('.solve-detail-main-answer');
        if (answer) {
          console.log("Answer element found inside iframe");
          const screenshotBytes = await answer.screenshot();
          console.log("Screenshot taken");
          return [screenshotBytes.toString('base64')];
        } else {
          console.log("Answer element not found inside iframe");
        }
      } else if (gpt35answers) {
        console.log("GPT-3.5 answer elements found");
        const answer = await page.$('.AnswerResult_answer-result__VSKWo');
        await new Promise(resolve => setTimeout(resolve, 5000));
        const screenshotBytes = await answer.screenshot();
        console.log("Screenshot taken");
        return [screenshotBytes.toString('base64')];
      } else {
        console.log("GPT-3.5 answer elements not found");
      }
    } else {
      console.log("Question not found");
    }
  } catch (e) {
    console.log(`An error occurred: ${e}`);
    return [];
  } finally {
    await page.close();
    await browser.close();
    console.log("Browser closed");
  }
  return [];
};

app.get('/', async (req, res) => {
  res.render('index');
});

const generateUniqueFilename = (label, extension) => {
  let filename = `${label}.${extension}`;
  let counter = 1;
  while (fs.existsSync(path.join(sessionFolder, filename))) {
    filename = `${label}_${counter}.${extension}`;
    counter++;
  }
  return filename;
};

app.post('/upload', upload.array('files'), async (req, res) => {
  const files = req.files;
  const labels = req.body.labels || [];
  const labelArray = Array.isArray(labels) ? labels : labels.split(',');

  if (!files || files.length === 0) {
    return res.send(renderNoFilesTemplate());
  }

  const responses = await Promise.all(files.map(async (file, index) => {
    const label = labelArray[index] || `Image ${index + 1}`;
    const filePath = path.join(uploadFolder, file.filename);
    const pngFilePath = filePath + '.png';

    try {
      await convertToPng(filePath, pngFilePath);
      let response = await getResponse(pngFilePath);
      fs.unlinkSync(filePath);
      fs.unlinkSync(pngFilePath);

      if (response.length > 0) {
        response.forEach((img, imgIndex) => {
          const filename = generateUniqueFilename(`${label}_${imgIndex + 1}`, 'png');
          const outputFilePath = path.join(sessionFolder, filename);
          fs.writeFileSync(outputFilePath, Buffer.from(img, 'base64'));
        });
      }

      return { label, response: response || [] };
    } catch (error) {
      console.error(`Error processing file ${file.filename}:`, error);
      return { label, response: [] };
    }
  }));

  if (!req.session.currentResponses) {
    req.session.currentResponses = [];
  }
  req.session.currentResponses = responses;
  if (!req.session.previousAnswers) {
    req.session.previousAnswers = [];
  }
  req.session.previousAnswers.push(...responses);

  res.json({ redirectUrl: '/responses' });
});

app.get('/responses', (req, res) => {
  const currentResponses = req.session.currentResponses || [];
  const responseHtml = currentResponses.map(({ label, response }) => {
    if (response.length > 0) {
      return `<div class="resultbox">${label}:<br>${response.map(img => `<img class="answerimg" src="data:image/png;base64,${img}" />`).join('')}</div>`;
    }
    return `<div>No answer was found for ${label}</div>`;
  }).join('');

  res.render('response', { responseHtml });
});

app.get('/previous-answers', (req, res) => {
  const previousAnswers = req.session.previousAnswers || [];
  const response = previousAnswers.flatMap(({ label, response }) => 
    response.map((img, index) => ({
      label: `${label}_${index + 1}`,
      response: img
    }))
  );
  res.json(response);
});

const renderNoFilesTemplate = () => `
  <!doctype html>
  <html>
  <head>
      <link rel="stylesheet" href="/static/styles.css">
      <title>Results</title>
  </head>
  <body>
      <h3 style="margin-top: 40vh; text-align: center;">You must enter at least one image.</h3>
      <h2 style="text-align: center;"><a href="/">Go back</a></h2>
  </body>
  </html>
`;

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
