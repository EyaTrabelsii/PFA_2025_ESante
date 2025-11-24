import Equipment from "../models/Equipment.js";

export const getEquipment = async (req, res) => {
  try {
    const equipment = await Equipment.find()
      .populate("assignedTo", "name email avatar profilePictureUrl")
      .populate("teamId");
    res.json(equipment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createEquipment = async (req, res) => {
  try {
    const equipment = new Equipment(req.body);
    const savedEquipment = await equipment.save();

    // Populate the assignedTo field before returning
    const populatedEquipment = await Equipment.findById(
      savedEquipment._id
    )
      .populate("assignedTo", "name email avatar profilePictureUrl")
      .populate("teamId");

    res.status(201).json(populatedEquipment);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const updateEquipment = async (req, res) => {
  try {
    const equipmentId = req.params.id;
    const updateData = { ...req.body };

    // If we're clearing the assignedTo field, also update status to available
    if (
      updateData.hasOwnProperty("assignedTo") &&
      !updateData.assignedTo
    ) {
      updateData.status = "available";
      updateData.$unset = { assignedTo: "" };
    }

    // If we're assigning to someone, update status to assigned
    if (updateData.assignedTo) {
      updateData.status = "assigned";
      updateData.assignedDate = new Date();
    }

    const updatedEquipment = await Equipment.findByIdAndUpdate(
      equipmentId,
      updateData,
      { new: true }
    )
      .populate("assignedTo", "name email avatar profilePictureUrl")
      .populate("teamId");

    res.json(updatedEquipment);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteEquipment = async (req, res) => {
  try {
    const equipmentId = req.params.id;
    await Equipment.findByIdAndDelete(equipmentId);
    res.json({ message: "Equipment deleted successfully" });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Assign equipment to a user
export const assignEquipment = async (req, res) => {
  try {
    const { equipmentId } = req.params;
    const { userId } = req.body;

    const updateData = userId
      ? {
          assignedTo: userId,
          status: "assigned",
          assignedDate: new Date(),
        }
      : {
          $unset: { assignedTo: "" },
          status: "available",
          $unset: { assignedDate: "" },
        };

    const updatedEquipment = await Equipment.findByIdAndUpdate(
      equipmentId,
      updateData,
      { new: true }
    )
      .populate("assignedTo", "name email avatar profilePictureUrl")
      .populate("teamId");

    if (!updatedEquipment) {
      return res.status(404).json({ message: "Equipment not found" });
    }

    res.json(updatedEquipment);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
