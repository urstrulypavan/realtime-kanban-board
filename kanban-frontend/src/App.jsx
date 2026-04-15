import { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Client } from '@stomp/stompjs';

const COLUMNS = ["TO_DO", "IN_PROGRESS", "DONE"];

function App() {
    const [tasks, setTasks] = useState([]);
    const [newTitle, setNewTitle] = useState("");
    const [newDesc, setNewDesc] = useState("");

    // Edit State
    const [editingId, setEditingId] = useState(null);
    const [editTitle, setEditTitle] = useState("");
    const [editDesc, setEditDesc] = useState("");

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
        fetchTasks();
    }, [fetchTasks]);

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
        return () => client.deactivate();
    }, []);

    const addTask = async () => {
        if (!newTitle || !newDesc) return;
        await axios.post('http://localhost:8080/api/tasks', { title: newTitle, description: newDesc, status: "TO_DO" });
        setNewTitle(""); setNewDesc("");
    };

    const deleteTask = async (id) => {
        await axios.delete(`http://localhost:8080/api/tasks/${id}`);
    };

    const startEditing = (task) => {
        setEditingId(task.id);
        setEditTitle(task.title);
        setEditDesc(task.description);
    };

    const saveEdit = async (id) => {
        try {
            await axios.put(`http://localhost:8080/api/tasks/${id}`, { title: editTitle, description: editDesc });
            setEditingId(null);
        } catch (err) { console.error("Edit failed:", err); }
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

        await axios.put(`http://localhost:8080/api/tasks/${draggableId}/status`, { status: destination.droppableId });
    };

    return (
        <div className="min-h-screen bg-[#0f172a] text-white p-8 font-sans">
            <header className="mb-10 text-center">
                <h1 className="text-4xl font-black tracking-tight">Engineering Kanban</h1>
            </header>

            <div className="flex justify-center mb-10 gap-2">
                <input className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 w-72 outline-none focus:ring-2 focus:ring-blue-500" placeholder="Title..." value={newTitle} onChange={e => setNewTitle(e.target.value)} />
                <input className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 w-64 outline-none focus:ring-2 focus:ring-blue-500" placeholder="Description..." value={newDesc} onChange={e => setNewDesc(e.target.value)} />
                <button onClick={addTask} className="bg-blue-600 px-6 py-2 rounded-lg font-bold hover:bg-blue-500 transition-all">+ Add</button>
            </div>

            <DragDropContext onDragEnd={onDragEnd}>
                <div className="flex gap-6 justify-center">
                    {COLUMNS.map(col => (
                        <div key={col} className="bg-slate-900 w-80 rounded-2xl p-5 border border-slate-800 min-h-[500px]">
                            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">{col.replace('_', ' ')}</h2>
                            <Droppable droppableId={col}>
                                {(provided) => (
                                    <div {...provided.droppableProps} ref={provided.innerRef} className="min-h-[400px]">
                                        {tasks.filter(t => t.status === col).map((task, index) => (
                                            <Draggable key={task.id} draggableId={task.id.toString()} index={index}>
                                                {(provided, snapshot) => (
                                                    <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}
                                                         className={`group relative bg-slate-800 p-4 rounded-xl mb-3 border border-slate-700 shadow-lg transition-all ${snapshot.isDragging ? 'ring-2 ring-blue-500' : ''}`}>

                                                        {editingId === task.id ? (
                                                            <div className="flex flex-col gap-2">
                                                                <input className="bg-slate-700 p-1 rounded border border-blue-500 outline-none" value={editTitle} onChange={e => setEditTitle(e.target.value)} />
                                                                <textarea className="bg-slate-700 p-1 rounded border border-blue-500 outline-none text-xs" value={editDesc} onChange={e => setEditDesc(e.target.value)} />
                                                                <div className="flex gap-2">
                                                                    <button onClick={() => saveEdit(task.id)} className="bg-green-600 text-xs px-2 py-1 rounded">Save</button>
                                                                    <button onClick={() => setEditingId(null)} className="bg-slate-600 text-xs px-2 py-1 rounded">Cancel</button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <button onClick={() => startEditing(task)} className="text-slate-500 hover:text-blue-400">
                                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                                    </button>
                                                                    <button onClick={() => deleteTask(task.id)} className="text-slate-500 hover:text-red-500">
                                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                                    </button>
                                                                </div>
                                                                <h3 className="font-bold text-white">{task.title}</h3>
                                                                <p className="text-sm text-slate-400 mt-1">{task.description}</p>
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