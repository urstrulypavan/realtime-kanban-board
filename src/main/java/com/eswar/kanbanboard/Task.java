package com.eswar.kanbanboard;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Data // This automatically creates Getters and Setters thanks to Lombok!
public class Task {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String title;
    private String description;
    private String status; // We'll start with "TO_DO", "IN_PROGRESS", "DONE"
}