import { todoListQuark } from "../quarks/todos";
import { ToDoElement } from "./todo-element";

export const ToDoList = () => {
  const todos = todoListQuark.use();

  return (
    <ul>
      {todos.value.map((todo) => (
        <li>
          <ToDoElement id={todo.id} />
        </li>
      ))}
    </ul>
  );
};
