import axios from "axios";
import fs from "fs";
import { mkdir, writeFile } from "fs/promises";
import FormData from "form-data";
import prisma from "../config/db.js";
import path from "path";

const redaction = async (filePath, docId) => {
    const form = new FormData();

    form.append("docId", docId);
    form.append("file", fs.createReadStream(filePath));

    const axiosConfig = {
        headers: form.getHeaders(),
        timeout: 120000,
        maxBodyLength: Infinity
    };

    try {
        const res = await axios.post(
            "http://localhost:8080/api/ai/redactionService",
            form,
            axiosConfig
        );
        const fileBuffer = Buffer.from(res.data.redactedFileBase64, 'base64');

        const uploadDir = path.join(process.cwd(), "uploads");

        await mkdir(uploadDir, { recursive: true });

        const redactedFileName = res.data.file.redactedFileName;

        const fileExtension =
            path.extname(redactedFileName) || ".bin";

        const savedFileName = `${Date.now()}${fileExtension}`;

        const absolutePath = path.join(uploadDir, savedFileName);

        await writeFile(
            absolutePath,
            fileBuffer
        );

        const document = await prisma.documents.update({
            where: {
                id: docId
            },
            data: {
                redactedFilePath: absolutePath,
                extractedText: res.data.extractedText,
                status: 'REDACTED'
            }
        });

        return document;

    } catch (e) {
        console.error("Redaction failed:", e);
        await prisma.documents.update({
            where: {id: docId},
            data: {
                status: 'FAILED'
            }
        })
        throw e;
    }
};

const mockRedaction = async (filePath, docId) => {
    try {
        console.log(`[MOCK] Simulating AI for document ${docId}...`);


        await new Promise(resolve => setTimeout(resolve, 3000));


        await prisma.documents.update({
            where: { id: docId },
            data: {
                extractedText: "FIR Report: Suspect apprehended near Ayodhya Bypass with a stolen Glock 19. Case registered under IPC 302.",
                redactedFilePath: filePath,
                status: "REDACTED"
            }
        });

        console.log(`[MOCK] Document ${docId} processed successfully.`);
    } catch (e) {
        console.error("[MOCK] Failed:", e);
        await prisma.documents.update({
            where: {id: docId},
            data: {
                status: "FAILED"
            }
        })
        throw e;
    }
};


export {mockRedaction, redaction};