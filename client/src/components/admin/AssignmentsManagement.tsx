import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Alert,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Chip,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import PersonIcon from "@mui/icons-material/Person";
import { staff, clients } from "../../services/api";
import { Client, Staff } from "../../types";

const AssignmentsManagement = () => {
  const [staffMembers, setStaffMembers] = useState<Staff[]>([]);
  const [availableClients, setAvailableClients] = useState<Client[]>([]);
  const [selectedStaff, setSelectedStaff] = useState("");
  const [selectedClient, setSelectedClient] = useState("");
  const [assignedClients, setAssignedClients] = useState<Client[]>([]);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [selectedShift, setSelectedShift] = useState<"AM" | "PM">("AM");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [staffSummary, setStaffSummary] = useState<{
    [key: string]: { amCount: number; pmCount: number };
  }>({});

  useEffect(() => {
    loadStaffMembers();
    loadAvailableClients();
    loadStaffSummary();
  }, []);

  useEffect(() => {
    if (selectedStaff) {
      loadAssignedClients(selectedStaff);
    } else {
      setAssignedClients([]);
    }
  }, [selectedStaff]);

  const loadStaffSummary = async () => {
    try {
      const staffResponse = await staff.getAll();
      const summary: { [key: string]: { amCount: number; pmCount: number } } =
        {};

      for (const staffMember of staffResponse.data) {
        const assignedClientsResponse = await staff.getAssignedClients(
          staffMember._id
        );
        const assignedClients: Client[] = assignedClientsResponse.data;

        summary[staffMember._id] = {
          amCount: assignedClients.filter(
            (client: Client) => client.timeShift === "AM"
          ).length,
          pmCount: assignedClients.filter(
            (client: Client) => client.timeShift === "PM"
          ).length,
        };
      }

      setStaffSummary(summary);
    } catch (error) {
      setError("Failed to load staff summary");
    }
  };

  const loadStaffMembers = async () => {
    try {
      const response = await staff.getAll();
      setStaffMembers(response.data);
    } catch (error) {
      setError("Failed to load staff members");
    }
  };

  const loadAvailableClients = async () => {
    try {
      const response = await clients.getAll();
      setAvailableClients(response.data);
    } catch (error) {
      setError("Failed to load clients");
    }
  };

  const loadAssignedClients = async (staffId: string) => {
    try {
      const response = await staff.getAssignedClients(staffId);
      setAssignedClients(response.data);
    } catch (error) {
      setError("Failed to load assigned clients");
    }
  };

  const handleAssign = async () => {
    try {
      setError("");
      setSuccess("");

      if (!selectedStaff || !selectedClient) {
        setError("Please select both staff member and client");
        return;
      }

      await staff.assignClient(selectedStaff, selectedClient);
      setSuccess("Assignment created successfully");

      // Update client's time shift
      const clientToUpdate = availableClients.find(
        (c) => c._id === selectedClient
      );
      if (clientToUpdate) {
        await clients.update(selectedClient, {
          ...clientToUpdate,
          timeShift: selectedShift,
        });
      }

      // Refresh all data
      loadAssignedClients(selectedStaff);
      loadAvailableClients();
      loadStaffSummary();
      setSelectedClient("");
    } catch (error) {
      setError("Failed to create assignment");
    }
  };

  const handleUnassign = async (clientId: string) => {
    try {
      setError("");
      setSuccess("");

      await staff.unassignClient(selectedStaff, clientId);
      setSuccess("Assignment removed successfully");

      // Refresh all data
      loadAssignedClients(selectedStaff);
      loadAvailableClients();
      loadStaffSummary();
    } catch (error) {
      setError("Failed to remove assignment");
    }
  };

  const handleEditTimeShift = async () => {
    try {
      if (!editingClient) return;

      await clients.update(editingClient._id, {
        ...editingClient,
        timeShift: selectedShift,
      });
      setSuccess("Time shift updated successfully");

      // Refresh data
      loadAssignedClients(selectedStaff);
      loadStaffSummary();
      setIsEditDialogOpen(false);
      setEditingClient(null);
    } catch (error) {
      setError("Failed to update time shift");
    }
  };

  const openEditDialog = (client: Client) => {
    setEditingClient(client);
    setSelectedShift(client.timeShift);
    setIsEditDialogOpen(true);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Assignments Management
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Paper sx={{ p: 2, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Staff Summary
            </Typography>
            <Grid container spacing={2}>
              {staffMembers.map((staffMember) => (
                <Grid item xs={12} sm={6} md={4} key={staffMember._id}>
                  <Card>
                    <CardHeader
                      avatar={<PersonIcon />}
                      title={staffMember.name}
                      subheader={staffMember.contactNumber}
                    />
                    <CardContent>
                      <Box sx={{ display: "flex", gap: 1, mb: 1 }}>
                        <Chip
                          label={`AM: ${
                            staffSummary[staffMember._id]?.amCount || 0
                          } clients`}
                          color="primary"
                          variant="outlined"
                        />
                        <Chip
                          label={`PM: ${
                            staffSummary[staffMember._id]?.pmCount || 0
                          } clients`}
                          color="secondary"
                          variant="outlined"
                        />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: "flex", gap: 2, mb: 3 }}>
              <FormControl fullWidth>
                <InputLabel>Staff Member</InputLabel>
                <Select
                  value={selectedStaff}
                  label="Staff Member"
                  onChange={(e) => setSelectedStaff(e.target.value)}
                >
                  <MenuItem value="">
                    <em>Select staff member</em>
                  </MenuItem>
                  {staffMembers.map((staff) => (
                    <MenuItem key={staff._id} value={staff._id}>
                      {staff.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>Client</InputLabel>
                <Select
                  value={selectedClient}
                  label="Client"
                  onChange={(e) => setSelectedClient(e.target.value)}
                  disabled={!selectedStaff}
                >
                  <MenuItem value="">
                    <em>Select client</em>
                  </MenuItem>
                  {availableClients
                    .filter(
                      (client) =>
                        !assignedClients.find((ac) => ac._id === client._id)
                    )
                    .map((client) => (
                      <MenuItem key={client._id} value={client._id}>
                        {client.name}
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>

              <FormControl>
                <InputLabel>Time Shift</InputLabel>
                <Select
                  value={selectedShift}
                  label="Time Shift"
                  onChange={(e) =>
                    setSelectedShift(e.target.value as "AM" | "PM")
                  }
                >
                  <MenuItem value="AM">AM</MenuItem>
                  <MenuItem value="PM">PM</MenuItem>
                </Select>
              </FormControl>

              <Button
                variant="contained"
                onClick={handleAssign}
                disabled={!selectedStaff || !selectedClient}
              >
                Assign
              </Button>
            </Box>

            {selectedStaff && (
              <Box>
                <Typography variant="h6" gutterBottom>
                  Assigned Clients
                </Typography>
                <List>
                  {assignedClients.map((client) => (
                    <ListItem key={client._id}>
                      <ListItemText
                        primary={client.name}
                        secondary={
                          <>
                            Phone: {client.number} | Time Shift:{" "}
                            {client.timeShift} | Quantity: {client.quantity}L
                          </>
                        }
                      />
                      <ListItemSecondaryAction>
                        <IconButton
                          edge="end"
                          aria-label="edit"
                          onClick={() => openEditDialog(client)}
                          sx={{ mr: 1 }}
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          edge="end"
                          aria-label="delete"
                          onClick={() => handleUnassign(client._id)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      <Dialog
        open={isEditDialogOpen}
        onClose={() => setIsEditDialogOpen(false)}
      >
        <DialogTitle>Edit Time Shift</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Time Shift</InputLabel>
            <Select
              value={selectedShift}
              label="Time Shift"
              onChange={(e) => setSelectedShift(e.target.value as "AM" | "PM")}
            >
              <MenuItem value="AM">AM</MenuItem>
              <MenuItem value="PM">PM</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleEditTimeShift} variant="contained">
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AssignmentsManagement;
