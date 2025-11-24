import express from "express";
import {
  getEquipment,
  createEquipment,
  updateEquipment,
  deleteEquipment,
  assignEquipment,
} from "../controllers/equipmentController.js";

const router = express.Router();

router.get("/", getEquipment);
router.post("/", createEquipment);
router.put("/:id", updateEquipment);
router.put("/:equipmentId/assign", assignEquipment);
router.delete("/:id", deleteEquipment);

export default router;
