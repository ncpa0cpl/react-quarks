import { quark } from "../../../dist"; // replace with `react-quarks` to run

export type ToDo = {
  id: number;
  taskDescription: string;
  taskLabel: string;
  isDone: boolean;
};

const ToDoListActions = {
  /** Adds new todo task to the list. */
  addToDoTask(state: ToDo[], todo: Omit<ToDo, "isDone">): ToDo[] {
    return [...state, { ...todo, isDone: false }];
  },
  /** Removes a specified todo task from the list. */
  removeToDoTask(state: ToDo[], id: number): ToDo[] {
    return state.filter((todo) => todo.id !== id);
  },
  /** Sets the specified todo task as done. */
  setTaskDone(state: ToDo[], id: number): ToDo[] {
    return state.map(
      (todo): ToDo => (todo.id === id ? { ...todo, isDone: true } : todo)
    );
  },
  /** Sets the specified todo task as not done. */
  setTaskNotDone(state: ToDo[], id: number): ToDo[] {
    return state.map(
      (todo): ToDo => (todo.id === id ? { ...todo, isDone: false } : todo)
    );
  },
};

const ToDoListSelectors = {
  useSelectToDoTask(state: ToDo[], id: number): ToDo | undefined {
    return state.find((todo) => todo.id === id);
  },
};

export const todoListQuark = quark(<ToDo[]>[], {
  actions: ToDoListActions,
  selectors: ToDoListSelectors,
});
