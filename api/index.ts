import 'dotenv/config';
import express from 'express';
import { createServerHandler } from '../serverHandler';

const app = createServerHandler();

export default app;
