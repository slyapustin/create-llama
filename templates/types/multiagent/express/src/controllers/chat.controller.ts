import { Message, StreamData, streamToResponse } from "ai";
import { Request, Response } from "express";
import { ChatMessage } from "llamaindex";
import { createWorkflow } from "../workflow";
import { createStreamTimeout } from "./llamaindex/streaming/events";
import { LlamaIndexStream } from "./llamaindex/streaming/stream";

export const chat = async (req: Request, res: Response) => {
  const vercelStreamData = new StreamData();
  const streamTimeout = createStreamTimeout(vercelStreamData);
  try {
    const { messages }: { messages: Message[] } = req.body;
    const userMessage = messages.pop();
    if (!messages || !userMessage || userMessage.role !== "user") {
      return res.status(400).json({
        error:
          "messages are required in the request body and the last message must be from the user",
      });
    }

    const chatHistory = messages as ChatMessage[];
    const agent = await createWorkflow(chatHistory);
    agent.run(userMessage.content);

    const stream = LlamaIndexStream(
      {
        [Symbol.asyncIterator]() {
          return agent.streamEvents();
        },
      },
      vercelStreamData,
      chatHistory,
    );

    return streamToResponse(stream, res, {}, vercelStreamData);
  } catch (error) {
    console.error("[LlamaIndex]", error);
    return res.status(500).json({
      detail: (error as Error).message,
    });
  } finally {
    clearTimeout(streamTimeout);
  }
};
