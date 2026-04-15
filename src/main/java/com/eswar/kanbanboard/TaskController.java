package com.eswar.kanbanboard;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tasks")
public class TaskController {

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @GetMapping
    public List<Task> getAllTasks() {
        return taskRepository.findAll();
    }

    @PostMapping
    public Task createTask(@RequestBody Task task) {
        Task savedTask = taskRepository.save(task);
        messagingTemplate.convertAndSend("/topic/tasks", savedTask);
        return savedTask;
    }

    @DeleteMapping("/{id}")
    public void deleteTask(@PathVariable Long id) {
        taskRepository.deleteById(id);
        messagingTemplate.convertAndSend("/topic/tasks/delete", id);
    }

    // Combined Update for Title, Description, and Status
    @PutMapping("/{id}")
    public Task updateTask(@PathVariable Long id, @RequestBody Task taskDetails) {
        return taskRepository.findById(id).map(task -> {
            if (taskDetails.getTitle() != null) task.setTitle(taskDetails.getTitle());
            if (taskDetails.getDescription() != null) task.setDescription(taskDetails.getDescription());
            if (taskDetails.getStatus() != null) task.setStatus(taskDetails.getStatus());

            Task updatedTask = taskRepository.save(task);
            messagingTemplate.convertAndSend("/topic/tasks", updatedTask);
            return updatedTask;
        }).orElseThrow(() -> new RuntimeException("Task not found with id " + id));
    }

    // Specific endpoint for Drag & Drop status changes
    @PutMapping("/{id}/status")
    public Task updateStatus(@PathVariable Long id, @RequestBody Map<String, String> statusUpdate) {
        return taskRepository.findById(id).map(task -> {
            task.setStatus(statusUpdate.get("status"));
            Task updatedTask = taskRepository.save(task);
            messagingTemplate.convertAndSend("/topic/tasks", updatedTask);
            return updatedTask;
        }).orElseThrow(() -> new RuntimeException("Task not found"));
    }
}