import React from "react";
import { ToDo, todoListQuark } from "../quarks/todos";

const indicatorStyle = {
  padding: 20,
};

export const ToDoElement = React.memo(({ id }: { id: number }) => {
  const todo: ToDo | undefined = todoListQuark.useSelectToDoTask(id);

  if (!todo) return <></>;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-between",
      }}
    >
      <h2
        style={{ color: "red", padding: 20 }}
        onClick={() => todoListQuark.removeToDoTask(id)}
      >
        X
      </h2>
      <h4 title={todo.taskDescription}>{todo.taskLabel}</h4>
      {todo.isDone ? (
        <span
          style={indicatorStyle}
          onClick={() => todoListQuark.setTaskNotDone(id)}
        >
          DONE!
        </span>
      ) : (
        <span style={indicatorStyle} onClick={() => todoListQuark.setTaskDone(id)}>
          In Progress
        </span>
      )}
    </div>
  );
});
