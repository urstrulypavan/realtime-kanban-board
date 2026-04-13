package com.eswar.kanbanboard;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate; // Required import
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tasks")
@CrossOrigin(origins = "http://localhost:5173")
public class TaskController {

    @Autowired
    private TaskRepository taskRepository;

    @Autowired // Added this so Spring injects the template
    private SimpMessagingTemplate messagingTemplate;

    // 1. Get all tasks
    @GetMapping
    public List<Task> getAllTasks() {
        return taskRepository.findAll();
    }

    // 2. Create a new task
    @PostMapping
    public Task createTask(@RequestBody Task task) {
        Task savedTask = taskRepository.save(task);

        // Broadcast the new task so it appears for everyone instantly
        messagingTemplate.convertAndSend("/topic/tasks", savedTask);

        return savedTask;
    }

    // 3. Update a task status (WebSocket Broadcast)
    @PutMapping("/{id}/status")
    public Task updateTaskStatus(@PathVariable Long id, @RequestBody Map<String, String> payload) {
        Task task = taskRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Task not found with id: " + id));

        task.setStatus(payload.get("status"));
        Task updatedTask = taskRepository.save(task);

        // BROADCAST: This tells all connected clients to update their UI
        messagingTemplate.convertAndSend("/topic/tasks", updatedTask);

        return updatedTask;
    }

    // 4. Delete a task
    @DeleteMapping("/{id}")
    public String deleteTask(@PathVariable Long id) {
        taskRepository.deleteById(id);

        // Optional: You could broadcast a "delete" event here as well
        return "Task with ID " + id + " has been deleted.";
    }
}