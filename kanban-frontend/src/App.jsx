import { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Client } from '@stomp/stompjs'; // Modern, Vite-friendly client

const COLUMNS = ["TO_DO", "IN_PROGRESS", "DONE"];

function App() {
    const [tasks, setTasks] = useState([]);
    const [newTitle, setNewTitle] = useState("");
    const [newDesc, setNewDesc] = useState("");
    const stompClientRef = useRef(null);

    const fetchTasks = useCallback(async () => {
        try {
            const response = await axios.get('http://localhost:8080/api/tasks');
            setTasks(response.data);
        } catch (err) {
            console.error("Fetch failed:", err);
        }
    }, []);
    useEffect(() => {
        const loadInitialData = async () => {
            await fetchTasks();
        };
        loadInitialData();
    }, [fetchTasks]);


    // WebSocket Connection logic
    useEffect(() => {
        const client = new Client({
            brokerURL: 'ws://localhost:8080/ws-kanban/websocket', // Note the 'ws://' and '/websocket' suffix
            reconnectDelay: 5000,
            heartbeatIncoming: 4000,
            heartbeatOutgoing: 4000,
        });

        client.onConnect = () => {
            console.log("Connected to WebSocket");
            client.subscribe('/topic/tasks', (message) => {
                const updatedTask = JSON.parse(message.body);
                // Functional update prevents "cascading renders" ESLint warning
                setTasks((prev) => {
                    const exists = prev.find(t => t.id === updatedTask.id);
                    if (exists) {
                        return prev.map(t => t.id === updatedTask.id ? updatedTask : t);
                    }
                    return [...prev, updatedTask];
                });
            });
        };

        client.onStompError = (frame) => {
            console.error('Broker reported error: ' + frame.headers['message']);
        };

        client.activate();
        stompClientRef.current = client;

        return () => {
            if (stompClientRef.current) stompClientRef.current.deactivate();
        };
    }, []);

    const addTask = async () => {
        if (!newTitle || !newDesc) return;
        try {
            await axios.post('http://localhost:8080/api/tasks', {
                title: newTitle,
                description: newDesc,
                status: "TO_DO"
            });
            setNewTitle("");
            setNewDesc("");
        } catch (err) {
            console.error("Add failed:", err);
        }
    };

    const onDragEnd = async (result) => {
        const { destination, source, draggableId } = result;
        if (!destination || (destination.droppableId === source.droppableId && destination.index === source.index)) return;

        // Optimistic UI Update
        setTasks((prev) => {
            const newList = [...prev];
            const index = newList.findIndex(t => t.id.toString() === draggableId);
            if (index !== -1) {
                newList[index] = { ...newList[index], status: destination.droppableId };
            }
            return newList;
        });

        try {
            await axios.put(`http://localhost:8080/api/tasks/${draggableId}/status`, {
                status: destination.droppableId
            });
        } catch (err) {
            console.error("Update failed, refreshing...", err);
            fetchTasks();
        }
    };

    return (
        <div className="min-h-screen bg-[#0f172a] text-white p-8 font-sans">
            <header className="mb-10 text-center">
                <h1 className="text-4xl font-black tracking-tight">Engineering Kanban</h1>
            </header>

            <div className="flex justify-center mb-10 gap-2">
                <input
                    className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 w-72 outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Task title..."
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                />
                <input
                    className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 w-64 outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Description..."
                    value={newDesc}
                    onChange={e => setNewDesc(e.target.value)}
                />
                <button onClick={addTask} className="bg-blue-600 px-6 py-2 rounded-lg font-bold hover:bg-blue-500 active:scale-95 transition-all">
                    + Add
                </button>
            </div>

            <DragDropContext onDragEnd={onDragEnd}>
                <div className="flex gap-6 justify-center">
                    {COLUMNS.map(col => (
                        <div key={col} className="bg-slate-900 w-80 rounded-2xl p-5 border border-slate-800 min-h-[500px] flex flex-col">
                            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 px-2">{col.replace('_', ' ')}</h2>
                            <Droppable droppableId={col}>
                                {(provided) => (
                                    <div {...provided.droppableProps} ref={provided.innerRef} className="flex-grow">
                                        {tasks.filter(t => t.status === col).map((task, index) => (
                                            <Draggable key={task.id} draggableId={task.id.toString()} index={index}>
                                                {(provided, snapshot) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        {...provided.dragHandleProps}
                                                        className={`bg-slate-800 p-4 rounded-xl mb-3 border border-slate-700 shadow-lg ${snapshot.isDragging ? 'ring-2 ring-blue-500' : ''}`}
                                                    >
                                                        <h3 className="font-bold">{task.title}</h3>
                                                        <p className="text-xs text-slate-400 mt-1">{task.description}</p>
                                                    </div>
                                                )}
                                            </Draggable>
                                        ))}
                                        {provided.placeholder}
                                    </div>
                                )}
                            </Droppable>
                        </div>
                    ))}
                </div>
            </DragDropContext>
        </div>
    );
}

export default App;