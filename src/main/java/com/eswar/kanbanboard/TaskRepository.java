package com.eswar.kanbanboard;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface TaskRepository extends JpaRepository<Task, Long> {
    // This interface now has methods like .save(), .findAll(), and .deleteById() automatically!
}