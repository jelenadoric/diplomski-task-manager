CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT users_username_not_empty
        CHECK (char_length(trim(username)) > 0),

    CONSTRAINT users_email_not_empty
        CHECK (char_length(trim(email)) > 0),

    CONSTRAINT users_username_unique
        UNIQUE (username),

    CONSTRAINT users_email_unique
        UNIQUE (email)
);

CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    owner_id INTEGER NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT projects_owner_fk
        FOREIGN KEY (owner_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT projects_name_not_empty
        CHECK (char_length(trim(name)) > 0)
);

CREATE TABLE IF NOT EXISTS project_members (
    project_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (project_id, user_id),

    CONSTRAINT project_members_project_fk
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT project_members_user_fk
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL,
    created_by INTEGER NOT NULL,
    assigned_to INTEGER,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'TODO',
    priority VARCHAR(10) NOT NULL DEFAULT 'MEDIUM',
    due_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT tasks_project_fk
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT tasks_created_by_fk
        FOREIGN KEY (created_by)
        REFERENCES users(id),

    CONSTRAINT tasks_assigned_to_fk
        FOREIGN KEY (assigned_to)
        REFERENCES users(id)
        ON DELETE SET NULL,

    CONSTRAINT tasks_title_not_empty
        CHECK (char_length(trim(title)) > 0),

    CONSTRAINT tasks_status_valid
        CHECK (status IN ('TODO', 'IN_PROGRESS', 'DONE')),

    CONSTRAINT tasks_priority_valid
        CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH'))
);

CREATE TABLE IF NOT EXISTS comments (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT comments_task_fk
        FOREIGN KEY (task_id)
        REFERENCES tasks(id)
        ON DELETE CASCADE,

    CONSTRAINT comments_user_fk
        FOREIGN KEY (user_id)
        REFERENCES users(id),

    CONSTRAINT comments_content_not_empty
        CHECK (char_length(trim(content)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_projects_owner_id
    ON projects(owner_id);

CREATE INDEX IF NOT EXISTS idx_project_members_user_id
    ON project_members(user_id);

CREATE INDEX IF NOT EXISTS idx_tasks_project_id
    ON tasks(project_id);

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to
    ON tasks(assigned_to);

CREATE INDEX IF NOT EXISTS idx_comments_task_id
    ON comments(task_id);