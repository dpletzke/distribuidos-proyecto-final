import { Router } from 'express';
import * as controller from '../controllers/denuncias.controller.js';
import { upload } from '../middlewares/upload.middleware.js';
import { idSchema } from '../validators/denuncias.validator.js';
export const router=Router();
router.route('/').post(upload,controller.create).get(controller.list);
router.route('/:id').get(controller.get).put((req,_res,next)=>{idSchema.parse(req.params.id);next();},upload,controller.update);
