# Interactive Task Injection & Multi-Algorithm Comparison Demonstration

## Overview

This document outlines the implementation plan for an interactive task injection system in the Digital-Twin-Dashboard that demonstrates how different offloading algorithms (Random, Greedy Distance, Greedy Compute, DDQN) handle the same task in parallel, comparing their performance metrics.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Digital-Twin-Dashboard                       │
│                     (Separate Server)                            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  New-Dashboard (HTML Frontend)                      │   │
│  │  ├─ Vehicle Selection Dropdown (Dynamic)                 │   │
│  │  ├─ Task Type Selection (Except Object Detection)        │   │
│  │  ├─ Task Injection Button                                │   │
│  │  └─ 4x Algorithm Results Panel (Latency, Energy, Status) │   │
│  └──────────────┬───────────────────────────────────────────┘   │
│                 │ REST API Call                                   │
│                 ▼                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Dashboard Backend API Server (Python/Flask)            │   │
│  │  ├─ POST /api/inject-task                                │   │
│  │  ├─ GET /api/active-vehicles                             │   │
│  │  ├─ GET /api/available-tasks                             │   │
│  │  └─ WebSocket /ws/task-results                           │   │
│  └──────────────┬───────────────────────────────────────────┘   │
│                 │ Redis Pub/Sub + REST                            │
└─────────────────┼───────────────────────────────────────────────┘
                  │
       ┌──────────┴──────────┐
       ▼                     ▼
┌─────────────────────┐ ┌────────────────────┐
│   Redis Server      │ │ Simulation Server  │
│ ┌─────────────────┐ │ │  (OMNeT++/SUMO)   │
│ │ Task Metadata   │ │ │                    │
│ │ Algorithm       │ │ │ ┌────────────────┐ │
│ │ Decisions       │ │ │ │ MyRSUApp       │ │
│ │ Results         │ │ │ ├─ Receive Task  │ │
│ └─────────────────┘ │ │ ├─ Publish to    │ │
│                     │ │ │   Redis Algo   │ │
│                     │ │ │   Queue         │ │
│                     │ │ └────────────────┘ │
│                     │ │ ┌────────────────┐ │
│                     │ │ │ Algo Executor  │ │
│                     │ │ ├─ Random        │ │
│                     │ │ ├─ Greedy Dist   │ │
│                     │ │ ├─ Greedy Comp   │ │
│                     │ │ └─ DDQN          │ │
│                     │ │ ┌────────────────┐ │
│                     │ │ │ Vehicle Apps   │ │
│                     │ │ ├─ Receive Dec.  │ │
│                     │ │ ├─ Execute Task  │ │
│                     │ │ └─ Collect Metrics│ │
│                     │ │ ┌────────────────┐ │
│                     │ │ │ Results Manager│ │
│                     │ │ ├─ Latency       │ │
│                     │ │ ├─ Energy        │ │
│                     │ │ └─ Success/Fail  │ │
│                     │ └────────────────────┘ │
└─────────────────────┘ └────────────────────┘
```

## Implementation Plan

### Phase 1: Dashboard Frontend (New-Dashboard)

#### 1.1 Vehicle Selection Component
**File**: `New-dashboard/src/components/TaskInjection/VehicleSelector.vue` (or `.jsx`)

**Features**:
- Real-time dropdown of active vehicles in simulation
- Vehicle status: `[Vehicle_ID] - Speed: X km/h - Position: Y`
- Automatic refresh every 500ms via WebSocket or polling
- Disable vehicles that are about to leave simulation

**Implementation**:
```javascript
// Pseudo-code
const activeVehicles = ref([]);

const fetchActiveVehicles = async () => {
  const response = await fetch('/api/active-vehicles');
  activeVehicles.value = response.data;
};

// Poll every 500ms
setInterval(fetchActiveVehicles, 500);
```

#### 1.2 Task Type Selection Component
**File**: `New-dashboard/src/components/TaskInjection/TaskTypeSelector.vue`

**Features**:
- Dropdown with available task types (excludes "Object Detection")
- Use the existing parameters of the tasks in the simulation in the task profile in omnet.


#### 1.3 Task Injection Button & Handler
**File**: `New-dashboard/src/components/TaskInjection/TaskInjectionPanel.vue`

**Features**:
- Button to inject selected task
- Show loading state during injection
- Success/error notification

**Implementation**:
```javascript
const injectTask = async () => {
  const payload = {
    vehicleId: selectedVehicle.value,
    taskType: selectedTaskType.value,
    timestamp: Date.now(),
    taskId: generateUUID(),
  };

  try {
    const response = await fetch('/api/inject-task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    
    if (response.ok) {
      showNotification('Task injected successfully', 'success');
      startWatchingResults(payload.taskId);
    }
  } catch (error) {
    showNotification(`Injection failed: ${error}`, 'error');
  }
};
```

#### 1.4 Results Display Panel
**File**: `New-dashboard/src/components/TaskInjection/ResultsPanel.vue`

**Features**:
- Display results for all 4 algorithms side-by-side
- Real-time updates via WebSocket
- Metrics: Latency (ms), Energy (mJ), Task Status (Success/Failed/Pending)

**Layout** (4-column comparison):
```
┌─────────────────────────────────────────────────────┐
│  RESULTS: Task #uuid | Vehicle: V23 | Type: Video  │
├──────────────┬──────────────┬──────────────┬────────┤
│   RANDOM     │ GREEDY-DIST  │ GREEDY-COMP  │  DDQN  │
├──────────────┼──────────────┼──────────────┼────────┤
│ Latency:     │ Latency:     │ Latency:     │Latency:│
│   234 ms     │   156 ms     │   189 ms     │ 123 ms │
├──────────────┼──────────────┼──────────────┼────────┤
│ Energy:      │ Energy:      │ Energy:      │Energy: │
│   450 mJ     │   380 mJ     │   420 mJ     │ 360 mJ │
├──────────────┼──────────────┼──────────────┼────────┤
│ Status:      │ Status:      │ Status:      │Status: │
│   SUCCESS    │   SUCCESS    │   SUCCESS    │SUCCESS │
└──────────────┴──────────────┴──────────────┴────────┘
```

---

### Phase 2: Dashboard Backend API Server

#### 2.1 API Endpoints
**File**: `server/routes/taskInjection.js` (or `.py`)

**Endpoints**:

##### a) GET `/api/active-vehicles`
```json
Response:
{
  "timestamp": 1234567890,
  "vehicles": [
    {
      "id": "V1",
      "speed": 45.2,
      "position": { "x": 1234.5, "y": 5678.9 },
      "route": "route0",
      "ttl": 45000  // Time-to-live (ms)
    },
    ...
  ]
}
```

**Implementation**:
- Query simulation via REST API: `GET http://simulation-server:5000/vehicles`
- Cache results with 200ms TTL
- Return only vehicles with TTL > 5 seconds

refer to task types in the simulation and hardcode them in the drop down to select 
    COOPERATIVE_PERCEPTION    /
    ROUTE_OPTIMIZATION ,     
    FLEET_TRAFFIC_FORECAST,      
    VOICE_COMMAND_PROCESSING     
    SENSOR_HEALTH_CHECK    

##### c) POST `/api/inject-task`
```json
Request:
{
  "vehicleId": "V23",
  "taskType": 1,
  "timestamp": 1234567890,
  "taskId": "task-uuid-xxx"
}

Response:
{
  "success": true,
  "taskId": "task-uuid-xxx",
  "message": "Task injected to Redis queue"
}
```

**Implementation**:
```python
@app.post('/api/inject-task')
def inject_task(request_data):
    vehicle_id = request_data['vehicleId']
    task_type = request_data['taskType']
    task_id = request_data['taskId']
    
    # Step 1: Create task payload
    task_payload = {
        'taskId': task_id,
        'vehicleId': vehicle_id,
        'taskType': task_type,
        'createdAt': time.time(),
        'source': 'dashboard'
    }
    
    # Step 2: Publish to Redis
    redis_client.lpush('simulation:task:queue', json.dumps(task_payload))
    
    # Step 3: Log for tracking
    redis_client.hset(f'task:{task_id}', mapping={
        'vehicleId': vehicle_id,
        'taskType': task_type,
        'status': 'injected',
        'createdAt': time.time()
    })
    
    return {'success': True, 'taskId': task_id}
```

#### 2.2 WebSocket Server for Real-time Results
**File**: `server/websocket/taskResultsWS.js`

**Features**:
- Listen to Redis Pub/Sub for results
- Push results to connected clients
- Handle client subscriptions per task

**Implementation**:
```javascript
io.on('connection', (socket) => {
  
  socket.on('subscribe-task', (taskId) => {
    // Subscribe to Redis channel
    const channelName = `task:results:${taskId}`;
    redisSubscriber.subscribe(channelName);
    
    // Forward Redis messages to client
    redisSubscriber.on('message', (channel, message) => {
      socket.emit('task-update', {
        taskId: taskId,
        results: JSON.parse(message)
      });
    });
  });
});
```

---

### Phase 3: Simulation Server Integration

#### 3.1 Task Reception & Processing
**File**: `IoV-Digital-Twin-TaskOffloading/MyRSUApp.cc` (extend existing)

**Features**:
- Monitor Redis queue: `simulation:task:queue`
- Extract injected tasks from queue
- Route to vehicle via MyRSUApp

**Implementation**:
```cpp
class MyRSUApp : public cSimpleModule {
  private:
    redis::Redis redis_client;
    
  protected:
    virtual void handleTaskQueue() {
      auto result = redis_client.lpop("simulation:task:queue");
      if (result) {
        json taskData = json::parse(result);
        
        // Route to vehicle
        sendTaskToVehicle(taskData);
        
        // Track in Redis
        redis_client.hset(
          "task:" + taskData["taskId"],
          "status", "received_at_rsu",
          "receivedTime", simTime().dbl()
        );
      }
    }
};
```

#### 3.2 Parallel Algorithm Execution
**File**: `IoV-Digital-Twin-TaskOffloading/AlgoExecutor.cc` (new component)

**Architecture**:
```
Task from RSU
    ↓
┌───────────────────────────────────┐
│    Algorithm Executor Module      │
├───┬───┬───┬────────────────────┤
│   │   │   │                    │
▼   ▼   ▼   ▼                    │
[Random] [Greedy-D] [Greedy-C] [DDQN]
   │        │          │        │
   │        │          │        │
   └────────┼──────────┼────────┘
            │
       Decision Queue
            │
   Redis: algo:{algo}:decision
```

**Implementation**:
```cpp
class AlgoExecutor : public cSimpleModule {
  private:
    enum AlgorithmType { RANDOM, GREEDY_DISTANCE, GREEDY_COMPUTE, DDQN };
    AlgorithmType algorithms[4] = {
      RANDOM, GREEDY_DISTANCE, GREEDY_COMPUTE, DDQN
    };
    
  protected:
    virtual void executeAlgorithms(json taskData, json networkState) {
      for (int i = 0; i < 4; i++) {
        // Run each algorithm in parallel (OMNeT++ modules)
        scheduleAt(simTime(), new AlgoExecMsg(taskData, algorithms[i]));
      }
    }
    
    virtual void handleAlgoResult(int algoType, json decision) {
      string algoNames[] = {"random", "greedy_distance", "greedy_compute", "ddqn"};
      string channel = "algo:" + algoNames[algoType] + ":decision";
      
      redis_client.publish(channel, decision.dump());
    }
};
```

# Make sure to use the existing agents as the algorithms in  Task-Offloading-Algorithm DDQN-Offloading-algorithm/src/agents

#### 3.3 Vehicle Task Execution & Metrics Collection
**File**: `IoV-Digital-Twin-TaskOffloading/PayloadVehicleApp.cc` (extend)

**Features**:
- Receive decisions from 4 algorithms
- Execute task according to each decision (4 parallel instances)
- Collect metrics: latency, energy, success/failure

**Implementation**:
```cpp
class PayloadVehicleApp : public cSimpleModule {
  private:
    struct TaskExecution {
      string taskId;
      string algoName;
      double injectionTime;
      double completionTime;
      double energyUsed;
      bool success;
    };
    
  protected:
    virtual void executeTaskDecision(json decision, string algoName) {
      TaskExecution exec;
      exec.taskId = decision["taskId"];
      exec.algoName = algoName;
      exec.injectionTime = simTime().dbl();
      
      // Simulate task execution
      double processingTime = taskProfile->getProcessingTime();
      scheduleAt(simTime() + processingTime, new TaskCompleteMsg(exec));
    }
    
    virtual void handleTaskComplete(TaskExecution &exec) {
      exec.completionTime = simTime().dbl();
      exec.energyUsed = calculateEnergyConsumption();
      exec.success = validateTaskExecution();
      
      // Publish results to Redis
      publishTaskResults(exec);
    }
    
    void publishTaskResults(const TaskExecution &exec) {
      json result = {
        {"taskId", exec.taskId},
        {"algorithm", exec.algoName},
        {"latency", (exec.completionTime - exec.injectionTime) * 1000},  // ms
        {"energy", exec.energyUsed},
        {"status", exec.success ? "success" : "failed"}
      };
      
      redis_client.publish(
        "task:results:" + exec.taskId,
        result.dump()
      );
    }
};
```

---

### Phase 4: Redis Data Flow

#### 4.1 Redis Channels & Keys

**Task Injection Queue**:
```
Key: simulation:task:queue
Type: List (FIFO)
Value: { taskId, vehicleId, taskType, createdAt, source }
```

**Task Metadata Tracking**:
```
Key: task:{taskId}
Type: Hash
Fields:
  - vehicleId
  - taskType
  - createdAt
  - algorithms_processing (array of algo names)
```

**Algorithm Decision Channels**:
```
Channel: algo:{algorithm_name}:decision
Value: { taskId, decision, timestamp }
Algorithm names: [random, greedy_distance, greedy_compute, ddqn]
```

**Task Results Channel**:
```
Channel: task:results:{taskId}
Value: [
  { algorithm, latency, energy, status },
  { algorithm, latency, energy, status },
  ...
]
Multiple messages (one per algorithm)
```

#### 4.2 Data Flow Timeline
```
t=0ms   Dashboard injects task → Task should be genrated in the vehicle -> Redis queue
        (simulation:task:queue)
          ↓
t=5ms   RSU polls queue → receives task metadata 
        Updates: task:{taskId} status=received_at_rsu
          ↓
t=10ms  RSU publishes to 4 algorithms
        Updates: task:{taskId} algorithms_processing=[random, greedy_distance, ...]
          ↓
t=15ms  4 Algorithms compute in parallel
        Each publishes decision to: algo:{algo_name}:decision
          ↓
t=30ms  Vehicles receive decisions
        Each starts task execution (4 parallel instances)
          ↓
t=80ms  Task completes
        Vehicle publishes to: task:results:{taskId}
        (4 messages from 4 algorithms)
          ↓
t=82ms  Dashboard receives via WebSocket
        UI updates results panel
```

---

### Phase 5: Frontend-Backend Real-time Communication

#### 5.1 WebSocket Event Flow
```
Frontend                          Backend                        Redis
   │                                │                             │
   ├─ subscribe-task: task-123 ────→ │                            │
   │                                ├─ SUBSCRIBE task:results:... ─→
   │                                │  (Redis Pub/Sub)            │
   │                                │                             │
   │                                │ ← PUBLISH (result msg) ─────┤
   │  ← task-update: {results} ─────┤                             │
   │  (update UI)                    │                             │
   │                                │ ← PUBLISH (next result) ────┤
   │  ← task-update: {results} ─────┤                             │
   │  (update UI)                    │                             │
```

---

### Phase 6: Testing Plan

#### 6.1 Unit Tests
- **Dashboard**: Vehicle selection, task type selection, UI rendering
- **Backend**: API endpoints, Redis operations, WebSocket handling
- **Simulation**: Task reception, algorithm execution, metrics calculation

#### 6.2 Integration Tests
1. **End-to-End Task Flow**:
   - Inject task via dashboard
   - Verify task reaches simulation via Redis
   - Verify 4 algorithms execute in parallel
   - Verify results return to dashboard
   
2. **Concurrent Tasks**:
   - Inject 3 different tasks simultaneously
   - Verify isolation between task executions
   - Verify results don't cross-contaminate

3. **Vehicle Availability**:
   - Inject task for vehicle about to depart
   - Verify handling of invalid vehicle selection

#### 6.3 Performance Tests
- Dashboard responsiveness with 100+ vehicles in dropdown
- Latency of task injection → simulation processing
- Redis throughput (tasks/sec)
- WebSocket message delivery rate

---

## Implementation Checklist

### Frontend (New-Dashboard)
- [ ] Create `TaskInjection/VehicleSelector` component
- [ ] Create `TaskInjection/TaskTypeSelector` component
- [ ] Create `TaskInjection/TaskInjectionPanel` component
- [ ] Create `TaskInjection/ResultsPanel` component
- [ ] Integrate WebSocket client for real-time updates
- [ ] Add CSS/styling for 4-column results layout
- [ ] Add error handling & notifications

### Backend API Server
- [ ] Create `/api/active-vehicles` endpoint
- [ ] Create `/api/available-tasks` endpoint
- [ ] Create `/api/inject-task` endpoint
- [ ] Implement WebSocket server for task results
- [ ] Add Redis client integration
- [ ] Add simulation server API integration
- [ ] Add logging & monitoring

### Simulation Server
- [ ] Extend `MyRSUApp` to poll Redis task queue
- [ ] Create `AlgoExecutor` module
- [ ] Extend `PayloadVehicleApp` to execute decisions
- [ ] Implement results publishing to Redis
- [ ] Add task metrics collection
- [ ] Add energy calculation
- [ ] Create OMNeT++ module registration files

### Redis Configuration
- [ ] Define all channel names & key structures
- [ ] Set up Pub/Sub subscriptions
- [ ] Configure TTLs for task data
- [ ] Add monitoring commands

---

## Configuration Files

### Dashboard Backend `.env`
```
REDIS_URL=redis://localhost:6379
SIMULATION_API_URL=http://localhost:5000
WEBSOCKET_PORT=8080
TASK_TTL_SECONDS=600
VEHICLE_UPDATE_INTERVAL_MS=500
```

### Simulation Server Config
```
REDIS_URL=redis://localhost:6379
TASK_QUEUE_POLL_INTERVAL_MS=10
ALGORITHM_EXECUTION_TIMEOUT_MS=500
METRICS_COLLECTION_ENABLED=true
```

---

## Deliverables

1. **Frontend Components** (React/Vue)
   - Vehicle selector with real-time updates
   - Task type selector
   - Task injection button
   - 4-column results display panel

2. **Backend API Server** (Node.js/Flask)
   - 3 REST endpoints
   - WebSocket server
   - Redis integration

3. **Simulation Extensions** (C++)
   - Task queue polling
   - Algorithm executor module
   - Results publisher
   - Metrics collector

4. **Documentation**
   - API specification
   - Component docs
   - Deployment guide
   - User manual

---

## Success Criteria

✓ User can select active vehicle and task type from dropdowns  
✓ Task injection button triggers API call  
✓ Task appears in simulation within 100ms  
✓ 4 algorithms execute in parallel  
✓ Results appear in dashboard within 5 seconds of task completion  
✓ Results show correct metrics (latency, energy, status)  
✓ UI remains responsive with 100+ vehicles  
✓ System handles concurrent task injections  

---

## Timeline Estimate

| Phase | Component | Effort | Duration |
|-------|-----------|--------|----------|
| 1 | Frontend UI Components | Medium | 3-4 days |
| 2 | Backend API Server | Medium | 2-3 days |
| 3 | Simulation Integration | High | 4-5 days |
| 4 | Redis Data Flow | Medium | 2 days |
| 5 | WebSocket Integration | Low-Med | 1-2 days |
| 6 | Testing & Debugging | High | 3-4 days |
| **Total** | | | **15-21 days** |

---

## Next Steps

1. **Choose Technology Stack** for dashboard backend (Node.js + Express vs Flask)
2. **Set up Project Structure** following monorepo best practices
3. **Design Database Schema** for task tracking in Redis
4. **Create API Specification** (OpenAPI/Swagger format)
5. **Develop Frontend Components** with mock data first
6. **Implement Backend** with proper error handling
7. **Integrate Simulation** with Redis clients
8. **Test End-to-End** flow
9. **Deploy** on separate servers
10. **Demonstrate** to stakeholders

---

## Notes

- **Isolation**: Each task execution per algorithm is fully isolated; one algorithm's decision doesn't affect others
- **Scalability**: System can handle 50-100 concurrent vehicles; beyond that may need load balancing
- **Fallback**: If one algorithm fails, others continue; partial results are still displayed
- **Monitoring**: All task flows are logged in Redis with timestamps for debugging
- **Future Enhancements**:
  - Task scheduling (schedule injection for future time)
  - Task priority levels
  - Algorithm weight/preference selection
  - Custom task profile creation
  - Historical results analysis

