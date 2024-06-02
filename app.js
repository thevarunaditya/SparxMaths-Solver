const { app: electronApp, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');
const { promisify } = require('util');
const playwright = require('playwright');
const bodyParser = require('body-parser');
const sharp = require('sharp');
const session = require('express-session');
const os = require('os');
const { Webhook } = require('discord-webhook-node');

const hook = new Webhook("https://discord.com/api/webhooks/1229163230975361135/gp8cXsFq6QQR_TBDHJasnp8ILfJajjjCybxanPhwBWRzByl9ldV-6dbUzcNGWS61XhAk");

let mainWindow;
let browserPromise;

// Function to send log message to Discord webhook
function logMessage(message) {
    hook.send(message);
}

// Function to create the main browser window
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        backgroundColor: '#232426',
        icon: path.join(__dirname, 'logo.ico'),
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
        },
    });

    mainWindow.setMenu(null);
    mainWindow.loadURL('http://localhost:3000/');
    mainWindow.on('closed', function () {
        mainWindow = null;
        logMessage('Main window closed');
    });
    logMessage('Main window created');
}

electronApp.on('ready', () => {
    logMessage('Application ready');
    createWindow();
});

electronApp.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        electronApp.quit();
        logMessage('Application quit');
    }
});

electronApp.on('activate', function () {
    if (mainWindow === null) {
        createWindow();
        logMessage('Application activated');
    }
});

electronApp.on('applicationSupportsSecureRestorableState', () => true);

const expressApp = express();

expressApp.use('/static', express.static(path.join(__dirname, 'static')));
expressApp.set('view engine', 'ejs');
expressApp.set('views', path.join(__dirname, 'templates'));
expressApp.use(bodyParser.urlencoded({ extended: true }));
expressApp.use(bodyParser.json());

const tempDir = os.platform() === 'win32' ? 'temp' : 'tmp';
const upload = multer({ dest: path.join(tempDir, 'uploads') });
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

expressApp.use(session({
    secret: 'notsosecret',
    resave: false,
    saveUninitialized: true,
    store: new session.MemoryStore({
        checkPeriod: 86400000
    })
}));

const writeFileAsync = promisify(fs.writeFile);
const readFileAsync = promisify(fs.readFile);

// Function to convert image to PNG format
const convertToPng = async (inputPath, outputPath) => {
    try {
        await sharp(inputPath)
            .png()
            .toFile(outputPath);
        logMessage(`Converted ${inputPath} to ${outputPath}`);
    } catch (error) {
        logMessage(`Error converting image to PNG: ${error}`);
    }
};

// Function to get the browser instance
const getBrowser = async () => {
    if (!browserPromise) {
        browserPromise = playwright.chromium.launch();
    }
    return browserPromise;
};

// Function to get the response from the website
const getResponse = async (filePath) => {
    logMessage('Starting browser for image processing...');
    const browser = await getBrowser();
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        await page.goto("https://gauthmath.com");
        logMessage('Loaded gauthmath.com page');
        const uploadElements = await page.$$('.UploadImage_file__Tdjhi');
        if (uploadElements.length > 0) {
            const firstUploadElement = uploadElements[0];
            await firstUploadElement.setInputFiles(filePath);
            logMessage(`Uploaded image ${filePath}`);
        } else {
            logMessage('No upload elements found on the page');
        }

        await new Promise(resolve => setTimeout(resolve, 5000));
        const question = await page.$('.Question_question-content__HcAVE');
        if (question) {
            const answers = await page.$$('.Card_card__Ds0Yk.CacheAnswer_answerInfo__23hl2');
            const iframeanswers = await page.$('iframe');
            const gpt35answers = await page.$('.AnswerResult_answer-result__VSKWo');
            if (answers.length >= 2) {
                const answer = answers[1];
                const screenshotBytes = await answer.screenshot();
                logMessage('Screenshot taken of the answer');
                return [screenshotBytes.toString('base64')];
            } else if (iframeanswers) {
                const frame = await iframeanswers.contentFrame();
                const answer = await frame.$('.solve-detail-main-answer');
                if (answer) {
                    const screenshotBytes = await answer.screenshot();
                    logMessage('Screenshot taken of the answer inside iframe');
                    return [screenshotBytes.toString('base64')];
                } else {
                    logMessage('Answer element not found inside iframe');
                }
            } else if (gpt35answers) {
                const answer = await page.$('.AnswerResult_answer-result__VSKWo');
                await new Promise(resolve => setTimeout(resolve, 5000));
                const screenshotBytes = await answer.screenshot();
                logMessage('Screenshot taken of the GPT-3.5 answer');
                return [screenshotBytes.toString('base64')];
            } else {
                logMessage('No answer elements found');
            }
        } else {
            logMessage('Question not found on the page');
        }
    } catch (e) {
        logMessage(`An error occurred while processing the image: ${e}`);
        return [];
    } finally {
        await page.close();
        logMessage('Image processing completed');
    }
    return [];
};

// Route for the home page
expressApp.get('/', async (req, res) => {
    res.render('index');
});

// Function to generate a unique filename
const generateUniqueFilename = (label, extension) => {
    let filename = `${label}.${extension}`;
    let counter = 1;
    while (fs.existsSync(path.join(sessionFolder, filename))) {
        filename = `${label}_${counter}.${extension}`;
        counter++;
    }
    return filename;
};

// Route for uploading files
expressApp.post('/upload', upload.array('files'), async (req, res) => {
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
            logMessage(`Processed file ${file.filename} for label ${label}`);
            return { label, response: response || [] };
        } catch (error) {
            logMessage(`Error processing file ${file.filename}: ${error}`);
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

// Route for displaying responses
expressApp.get('/responses', (req, res) => {
    const currentResponses = req.session.currentResponses || [];
    const responseHtml = currentResponses.map(({ label, response }) => {
        if (response.length > 0) {
            return `<div class="resultbox">${label}:<br>${response.map(img => `
                <div class="answerimg-container" data-label="${label}">
                    <img class="answerimg" src="data:image/png;base64,${img}" data-label="${label}" />
                    <div class="reload-icon">🔄️</div>
                </div>`).join('')}</div>`;
        }
        return `<div>No answer was found for ${label}</div>`;
    }).join('');

    res.render('response', { responseHtml });
});

// Route for retrieving previous answers
expressApp.get('/previous-answers', (req, res) => {
    const previousAnswers = req.session.previousAnswers || [];
    const response = previousAnswers.flatMap(({ label, response }) => 
        response.map((img, index) => ({
            label: `${label}_${index + 1}`,
            response: img
        }))
    );
    res.json(response);
});

// Route for reprocessing an image
expressApp.post('/reprocess', async (req, res) => {
    const { image, label } = req.body;

    const tempImagePath = path.join(uploadFolder, `temp_${Date.now()}.png`);
    const pngBuffer = Buffer.from(image, 'base64');
    await writeFileAsync(tempImagePath, pngBuffer);

    const responses = await getResponse(tempImagePath);
    fs.unlinkSync(tempImagePath);

    if (responses.length > 0) {
        const newImage = responses[0];

        if (req.session.previousAnswers) {
            req.session.previousAnswers = req.session.previousAnswers.map(answer => {
                if (answer.label === label) {
                    return { label, response: [newImage] };
                }
                return answer;
            });
        }

        res.json({ newImage });
    } else {
        res.status(500).json({ error: 'Failed to reprocess image' });
    }
});

// Template for rendering when no files are uploaded
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
expressApp.listen(PORT, () => {
    logMessage(`Server is running on http://localhost:${PORT}`);
});