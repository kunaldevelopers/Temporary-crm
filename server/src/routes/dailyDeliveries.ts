import { Router, Request, Response, NextFunction } from "express";
import { DailyDelivery } from "../models/DailyDelivery";
import { StaffSession } from "../models/StaffSession";
import { authMiddleware } from "../middleware/auth";
import { Client } from "../models/Client";
import { Staff } from "../models/Staff";
import mongoose from "mongoose";

const router = Router();

// Helper to wrap async handlers
const asyncHandler =
  (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// Apply auth middleware directly
router.use(authMiddleware);

// Get all deliveries for a specific date, optionally filtered by shift
router.get(
  "/:date",
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const dateParam = req.params.date;
      const { shift } = req.query;

      // Parse the date, defaulting to today if invalid
      let date: Date;
      try {
        date = new Date(dateParam);
        // Check if the date is valid
        if (isNaN(date.getTime())) {
          throw new Error("Invalid date");
        }
      } catch {
        date = new Date();
      }

      // Set time to midnight for consistent comparison
      date.setHours(0, 0, 0, 0);

      // Build the query
      const query: any = { date };
      if (shift && ["AM", "PM"].includes(shift as string)) {
        query.shift = shift;
      }

      // Fetch the deliveries with populated client and staff data
      const dailyDeliveries = await DailyDelivery.find(query)
        .populate({
          path: "clientId",
          select: "name number location timeShift quantity pricePerLitre",
        })
        .populate({
          path: "staffId",
          select: "name shift contactNumber",
        });

      console.log(
        `Fetched ${dailyDeliveries.length} deliveries for ${
          date.toISOString().split("T")[0]
        }${shift ? `, shift: ${shift}` : ""}`
      );

      res.json(dailyDeliveries);
    } catch (error) {
      console.error("Error fetching daily deliveries:", error);
      res.status(500).json({
        message: "Error fetching daily deliveries",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  })
);

// Get staff's deliveries for a specific date, filtered by their selected shift
router.get(
  "/staff/:staffId/:date",
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const { staffId, date: dateParam } = req.params;

      if (!mongoose.Types.ObjectId.isValid(staffId)) {
        return res.status(400).json({ message: "Invalid staff ID format" });
      }

      // Parse the date, defaulting to today if invalid
      let date: Date;
      try {
        date = new Date(dateParam);
        // Check if the date is valid
        if (isNaN(date.getTime())) {
          throw new Error("Invalid date");
        }
      } catch {
        date = new Date();
      }

      // Set time to midnight for consistent comparison
      date.setHours(0, 0, 0, 0);

      // Get the staff's selected shift for this date
      const staffSession = await StaffSession.findOne({ staffId, date });
      if (!staffSession) {
        // Get clients who are assigned to the staff and need to be displayed initially
        const staff = await Staff.findById(staffId).populate({
          path: "assignedClients",
          match: { timeShift: { $exists: true } }, // Match clients with timeShift field
          select:
            "name number location timeShift quantity pricePerLitre deliveryStatus deliveryNotes",
        });

        if (!staff) {
          return res.status(404).json({ message: "Staff not found" });
        }

        // Return the assigned clients grouped by shift
        const clientsByShift = {
          AM: (staff.assignedClients as any[]).filter(
            (client) => client.timeShift === "AM"
          ),
          PM: (staff.assignedClients as any[]).filter(
            (client) => client.timeShift === "PM"
          ),
        };

        return res.status(400).json({
          message: "No shift selected for this date",
          clientsByShift,
          requireShiftSelection: true,
        });
      }

      // Find all clients assigned to this staff
      const staff = await Staff.findById(staffId);
      if (!staff) {
        return res.status(404).json({ message: "Staff not found" });
      }

      // Find clients that match the staff's selected shift
      const clients = await Client.find({
        _id: { $in: staff.assignedClients },
        timeShift: staffSession.shift,
      });

      const clientIds = clients.map((client) => client._id);

      // Find existing delivery records
      const existingDeliveries = await DailyDelivery.find({
        clientId: { $in: clientIds },
        staffId,
        date,
        shift: staffSession.shift,
      }).populate({
        path: "clientId",
        select: "name number location timeShift quantity pricePerLitre",
      });

      // Create pending delivery objects for clients that don't have records yet
      const existingClientIds = existingDeliveries.map((delivery) =>
        delivery.clientId instanceof mongoose.Types.ObjectId
          ? delivery.clientId.toString()
          : (delivery.clientId as any)._id.toString()
      );

      const pendingDeliveries = clients
        .filter((client) => !existingClientIds.includes(client._id.toString()))
        .map((client) => ({
          _id: new mongoose.Types.ObjectId(),
          clientId: client,
          staffId,
          date,
          shift: staffSession.shift,
          deliveryStatus: "Not Delivered",
          quantity: 0,
          price: 0,
          isPending: true, // Flag to indicate this is not saved to DB yet
        }));

      // Combine existing and pending deliveries
      const allDeliveries = [...existingDeliveries, ...pendingDeliveries];

      console.log(
        `Fetched ${existingDeliveries.length} existing and ${
          pendingDeliveries.length
        } pending deliveries for staff ${staffId} on ${
          date.toISOString().split("T")[0]
        }, shift: ${staffSession.shift}`
      );

      res.json({
        deliveries: allDeliveries,
        staffSession,
        date: date.toISOString().split("T")[0],
      });
    } catch (error) {
      console.error("Error fetching staff's daily deliveries:", error);
      res.status(500).json({
        message: "Error fetching daily deliveries",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  })
);

// Generate daily delivery statistics
router.get(
  "/stats/:date",
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const dateParam = req.params.date;
      const { shift } = req.query;

      // Parse the date, defaulting to today if invalid
      let date: Date;
      try {
        date = new Date(dateParam);
        // Check if the date is valid
        if (isNaN(date.getTime())) {
          throw new Error("Invalid date");
        }
      } catch {
        date = new Date();
      }

      // Set time to midnight for consistent comparison
      date.setHours(0, 0, 0, 0);

      // Build the query
      const query: any = { date };
      if (shift && ["AM", "PM"].includes(shift as string)) {
        query.shift = shift;
      }

      // Get total deliveries and statistics
      const [deliveries, totalDelivered, totalNotDelivered] = await Promise.all(
        [
          DailyDelivery.find(query),
          DailyDelivery.countDocuments({
            ...query,
            deliveryStatus: "Delivered",
          }),
          DailyDelivery.countDocuments({
            ...query,
            deliveryStatus: "Not Delivered",
          }),
        ]
      );

      // Calculate quantities and revenue
      const totalQuantity = deliveries.reduce(
        (sum, delivery) => sum + delivery.quantity,
        0
      );
      const totalRevenue = deliveries.reduce(
        (sum, delivery) => sum + delivery.price,
        0
      );

      const stats = {
        date: date.toISOString().split("T")[0],
        shift: shift || "All",
        totalDeliveries: deliveries.length,
        totalDelivered,
        totalNotDelivered,
        totalQuantity,
        totalRevenue,
        deliveryPercentage: deliveries.length
          ? (totalDelivered / deliveries.length) * 100
          : 0,
      };

      console.log(
        `Generated stats for ${date.toISOString().split("T")[0]}${
          shift ? `, shift: ${shift}` : ""
        }`
      );

      res.json(stats);
    } catch (error) {
      console.error("Error generating daily delivery stats:", error);
      res.status(500).json({
        message: "Error generating statistics",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  })
);

export const dailyDeliveriesRouter = router;

// Step 3 implemented: Created daily deliveries routes with shift and date filtering
