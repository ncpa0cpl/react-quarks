import React from "react";
import { todoListQuark } from "../quarks/todos";

let i = 0;

export const ToDoForm = () => {
  const [labelInputValue, setLabelInputValue] = React.useState("");
  const [descriptionInputValue, setDescriptionInputValue] = React.useState("");

  const onAddClick = () => {
    if (labelInputValue.length > 0 && descriptionInputValue.length > 0) {
      todoListQuark.addToDoTask({
        id: i++,
        taskLabel: labelInputValue,
        taskDescription: descriptionInputValue,
      });

      setLabelInputValue("");
      setDescriptionInputValue("");
    }
  };

  return (
    <div>
      <h3>Add New ToDo:</h3>
      <table>
        <tbody>
          <tr>
            <td>
              <label htmlFor="todo-label">Label:</label>
            </td>
            <td>
              <input
                name="todo-label"
                value={labelInputValue}
                onInput={(e) => setLabelInputValue(e.currentTarget.value)}
              />
            </td>
          </tr>
          <tr>
            <td>
              <label htmlFor="todo-description">Description:</label>
            </td>
            <td>
              <input
                name="todo-description"
                value={descriptionInputValue}
                onInput={(e) => setDescriptionInputValue(e.currentTarget.value)}
              />
            </td>
          </tr>
        </tbody>
      </table>
      <button onClick={onAddClick}>Add</button>
    </div>
  );
};
