import { GoogleGenerativeAI } from "@google/generative-ai";
import readline from "readline";


// Initialize the API with your key
const genAI = new GoogleGenerativeAI("AIzaSyBJTWwIP73uyOZ5YZquNPl7lahnc_Z7lHk");
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// 'history' persists the conversation for this session
const chat = model.startChat({
  history: [], 
  generationConfig: {
    maxOutputTokens: 500,
  },
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});


const askQuestion = () => {
  rl.question("You: ", async (userInput) => {
    if (userInput.toLowerCase() === "exit") {
      console.log("Goodbye!");
      rl.close();
      return;
    }

    try {
      // sendMessage automatically updates the chat.history internally
      const result = await chat.sendMessage(userInput);
      const response = await result.response;
      const text = response.text();
      
      console.log(`\nGemini: ${text}\n`);
    } catch (error) {
      console.error("Error:", error.message);
    }

    // Loop to keep the conversation going
    askQuestion();
  });
};

askQuestion();