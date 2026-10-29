import { Router } from 'express';
import * as controller from '../controllers/mascotas.controller.js';
import { upload } from '../middlewares/upload.middleware.js';
export const mascotasRouter = Router();
mascotasRouter.route('/').get(controller.list).post(upload, controller.create);
mascotasRouter.route('/:id').get(controller.get).delete(controller.remove);
