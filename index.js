import OpenAI from "openai";
import fs from "fs";
import rl from "readline";
const readline = rl.createInterface({
	input: process.stdin,
});
const openAi = new OpenAI({
	apiKey: process.env.CHAT_GPT_API_KEY,
});

const initialize = async () => {
	const [file, thread] = await Promise.all([
		openAi.files.create({
			file: fs.createReadStream("schedule.txt"),
			purpose: "assistants",
		}),
		openAi.beta.threads.create(),
	]);
	const assistant = await openAi.beta.assistants.create({
		name: "Linda",
		description: "My Calendar Assistant",
		instructions: `
			{
				"prompt": "Hey Peter! 👋 I'm your personal assistant, ready to help with your schedule. Ask me anything!",
				"guidelines": {
					"tone": "Friendly and casual",
					"questions": "Feel free to ask more questions to help me understand better!",
					"conciseness": "I'll keep it short and straight to the point.",
					"file_access": "If the system can't access the file, just skip and not let me know",
					"response_format": "readable text"
				},
				"restrictions": "Only answer questions from the provided knowledge base file."
			}
			`,
		tools: [{ type: "retrieval" }],
		// model: "gpt-4-1106-preview",
		model: "gpt-3.5-turbo-1106",
		file_ids: [file.id],
	});

	return { file, assistant, thread };
};

/**
	@returns {Promise<string>}
 */
const getQuestion = () => {
	return new Promise((resolve, reject) => {
		readline.question("", (question) => {
			resolve(question);
		});
	});
};

/**
	@param {string} question
	@param {OpenAI.Files.FileObject} file
	@param {OpenAI.Beta.Threads.Thread} thread
	@param {OpenAI.Beta.Assistants.Assistant} assistant
 */
const processQuestion = async (thread, assistant, question, file) => {
	const [message, run] = await Promise.all([
		openAi.beta.threads.messages.create(thread.id, {
			role: "user",
			content: question,
			file_ids: [file.id],
		}),
		openAi.beta.threads.runs.create(thread.id, {
			assistant_id: assistant.id,
		}),
	]);
	return { message, run };
};

/**
	@param {OpenAI.Beta.Threads.Thread} thread
 */
const getAndPrintAnswer = async (thread) => {
	const messages = await openAi.beta.threads.messages.list(thread.id);
	const message = messages.data[0].content[0].text.value;
	console.log(message.replace("\n", /\n/g));
};

/**
	@param {OpenAI.Beta.Threads.Runs.Run} run
	@param {OpenAI.Beta.Threads.Thread} thread
 */
const waitForAnswerToBeReady = async (run, thread) => {
	console.log("processing...");
	const startTime = performance.now();
	while (true) {
		const state = await openAi.beta.threads.runs.retrieve(thread.id, run.id);
		if (state.status === "completed") {
			break;
		}
	}
	const endTime = performance.now();
	const executionTime = endTime - startTime;
	console.log("execution time:", (executionTime / 1000).toFixed(2), "seconds");
};

const bootstrap = async () => {
	const { thread, assistant, file } = await initialize();
	console.log(`hi Peter, what is your question?`);
	while (true) {
		const question = await getQuestion();
		const { run } = await processQuestion(thread, assistant, question, file);
		await waitForAnswerToBeReady(run, thread);
		await getAndPrintAnswer(thread);
	}
};

bootstrap();

/**
TODO:
- know when the assistant is done
- execute custom functions
 */
