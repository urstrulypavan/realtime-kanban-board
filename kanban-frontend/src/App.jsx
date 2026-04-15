import { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Client } from '@stomp/stompjs';

const COLUMNS = ["TO_DO", "IN_PROGRESS", "DONE"];

function App() {
    const [tasks, setTasks] = useState([]);
    const [newTitle, setNewTitle] = useState("");
    const [newDesc, setNewDesc] = useState("");
    const [assignee, setAssignee] = useState("");
    const [priority, setPriority] = useState("MEDIUM");

    const [editingId, setEditingId] = useState(null);
    const [editTitle, setEditTitle] = useState("");
    const [editDesc, setEditDesc] = useState("");

    const stompClientRef = useRef(null);

    // 1. Memoize the fetch function strictly
    const fetchTasks = useCallback(async () => {
        try {
            const response = await axios.get('http://localhost:8080/api/tasks');
            // Using functional update avoids dependency on the 'tasks' state itself
            setTasks(response.data);
        } catch (err) {
            console.error("Fetch failed:", err);
        }
    }, []);

    // 2. The Initial Load Effect
    // We remove fetchTasks from the dependency array to stop the "cascading render" warning,
    // as we only want this to run once on mount.
    useEffect(() => {
        fetchTasks();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 3. The WebSocket Effect
    useEffect(() => {
        const client = new Client({
            brokerURL: 'ws://localhost:8080/ws-kanban/websocket',
            reconnectDelay: 5000,
            onConnect: () => {
                client.subscribe('/topic/tasks', (message) => {
                    const updatedTask = JSON.parse(message.body);
                    setTasks((prev) => {
                        const exists = prev.find(t => t.id === updatedTask.id);
                        if (exists) return prev.map(t => t.id === updatedTask.id ? updatedTask : t);
                        return [...prev, updatedTask];
                    });
                });

                client.subscribe('/topic/tasks/delete', (message) => {
                    const deletedId = JSON.parse(message.body);
                    setTasks(prev => prev.filter(t => t.id !== deletedId));
                });
            },
        });

        client.activate();
        stompClientRef.current = client;

        return () => {
            if (stompClientRef.current) stompClientRef.current.deactivate();
        };
    }, []); // Empty array ensures this only runs once

    const addTask = async () => {
        if (!newTitle || !newDesc) return;
        try {
            await axios.post('http://localhost:8080/api/tasks', {
                title: newTitle,
                description: newDesc,
                assignee: assignee || "Unassigned",
                priority: priority,
                status: "TO_DO"
            });
            setNewTitle("");
            setNewDesc("");
            setAssignee("");
            setPriority("MEDIUM");
        } catch (err) { console.error(err); }
    };

    const deleteTask = async (id) => {
        try {
            await axios.delete(`http://localhost:8080/api/tasks/${id}`);
        } catch (err) { console.error(err); }
    };

    const startEditing = (task) => {
        setEditingId(task.id);
        setEditTitle(task.title);
        setEditDesc(task.description);
    };

    const saveEdit = async (id) => {
        try {
            await axios.put(`http://localhost:8080/api/tasks/${id}`, {
                title: editTitle,
                description: editDesc
            });
            setEditingId(null);
        } catch (err) { console.error(err); }
    };

    const onDragEnd = async (result) => {
        const { destination, source, draggableId } = result;
        if (!destination || (destination.droppableId === source.droppableId && destination.index === source.index)) return;

        setTasks(prev => {
            const newList = [...prev];
            const index = newList.findIndex(t => t.id.toString() === draggableId);
            if (index !== -1) newList[index] = { ...newList[index], status: destination.droppableId };
            return newList;
        });

        try {
            await axios.put(`http://localhost:8080/api/tasks/${draggableId}/status`, { status: destination.droppableId });
        } catch (err) {
            console.error(err);
            fetchTasks(); // Sync back if server update fails
        }
    };

    return (
        <div className="min-h-screen bg-[#0f172a] text-white p-8 font-sans">
            <header className="mb-10 text-center">
                <h1 className="text-4xl font-black tracking-tight text-white">Engineering Kanban</h1>
            </header>

            {/* Form */}
            <div className="flex flex-wrap justify-center mb-10 gap-3">
                <input className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 w-64 outline-none focus:ring-2 focus:ring-blue-500" placeholder="Title..." value={newTitle} onChange={e => setNewTitle(e.target.value)} />
                <input className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 w-64 outline-none focus:ring-2 focus:ring-blue-500" placeholder="Description..." value={newDesc} onChange={e => setNewDesc(e.target.value)} />
                <input className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 w-40 outline-none focus:ring-2 focus:ring-blue-500" placeholder="Assignee..." value={assignee} onChange={e => setAssignee(e.target.value)} />
                <select className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500" value={priority} onChange={e => setPriority(e.target.value)}>
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                </select>
                <button onClick={addTask} className="bg-blue-600 px-6 py-2 rounded-lg font-bold hover:bg-blue-500 transition-all">+ Add Task</button>
            </div>

            <DragDropContext onDragEnd={onDragEnd}>
                <div className="flex gap-6 justify-center overflow-x-auto pb-10">
                    {COLUMNS.map(col => (
                        <div key={col} className="bg-slate-900 w-80 rounded-2xl p-5 border border-slate-800 min-h-[600px] flex-shrink-0">
                            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-6 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                {col.replace('_', ' ')}
                            </h2>
                            <Droppable droppableId={col}>
                                {(provided) => (
                                    <div {...provided.droppableProps} ref={provided.innerRef} className="min-h-[500px]">
                                        {tasks.filter(t => t.status === col).map((task, index) => (
                                            <Draggable key={task.id} draggableId={task.id.toString()} index={index}>
                                                {(provided, snapshot) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        {...provided.dragHandleProps}
                                                        className={`group relative bg-slate-800 p-5 rounded-xl mb-4 border border-[#475569] shadow-lg transition-all ${snapshot.isDragging ? 'ring-2 ring-blue-500 rotate-2' : 'hover:border-slate-500'}`}
                                                    >
                                                        {editingId === task.id ? (
                                                            <div className="flex flex-col gap-3">
                                                                <input className="bg-slate-700 p-2 rounded border border-blue-500 outline-none text-white text-sm" value={editTitle} onChange={e => setEditTitle(e.target.value)} />
                                                                <textarea className="bg-slate-700 p-2 rounded border border-blue-500 outline-none text-xs text-slate-300" rows="3" value={editDesc} onChange={e => setEditDesc(e.target.value)} />
                                                                <div className="flex gap-2">
                                                                    <button onClick={() => saveEdit(task.id)} className="bg-green-600 text-[10px] font-bold uppercase px-3 py-1 rounded">Save</button>
                                                                    <button onClick={() => setEditingId(null)} className="bg-slate-600 text-[10px] font-bold uppercase px-3 py-1 rounded">Cancel</button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                                                    <button onClick={() => startEditing(task)} className="p-1 bg-slate-700 rounded hover:text-blue-400 text-slate-400">
                                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                                    </button>
                                                                    <button onClick={() => deleteTask(task.id)} className="p-1 bg-slate-700 rounded hover:text-red-500 text-slate-400">
                                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                                    </button>
                                                                </div>

                                                                <div className="flex justify-between items-start mb-3">
                                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                                                        task.priority === 'HIGH' ? 'bg-red-500/20 text-red-400' :
                                                                            task.priority === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-400' :
                                                                                'bg-green-500/20 text-green-400'
                                                                    }`}>
                                                                        {task.priority}
                                                                    </span>
                                                                    <span className="text-[10px] text-slate-500 font-medium">
                                                                        {task.createdAt ? new Date(task.createdAt).toLocaleDateString() : new Date().toLocaleDateString()}
                                                                    </span>
                                                                </div>

                                                                <h3 className="font-bold text-white text-lg leading-tight">{task.title}</h3>
                                                                <p className="text-sm text-slate-400 mt-2 line-clamp-2 leading-relaxed">{task.description}</p>

                                                                <div className="mt-5 pt-3 border-t border-slate-700 flex justify-between items-center">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold shadow-inner">
                                                                            {(task.assignee || "U").charAt(0).toUpperCase()}
                                                                        </div>
                                                                        <span className="text-xs text-slate-300 font-medium">{task.assignee || "Unassigned"}</span>
                                                                    </div>
                                                                </div>
                                                            </>
                                                        )}
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