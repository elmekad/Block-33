const express = require('express');
const { Client } = require('pg');
const path = require('path');

// Initialize Express app
const app = express();
app.use(express.json()); // Middleware to parse JSON bodies

// PostgreSQL client setup
const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:zanyraccoon881@localhost:5432/acme_hr_directory',
});

client.connect()
  .then(() => {
    console.log('Connected to PostgreSQL');
    initDb(); // Call the function to initialize the database
  })
  .catch(err => {
    console.error('Failed to connect to PostgreSQL', err);
  });

// Function to initialize the database
const initDb = async () => {
  const createDepartmentsTableQuery = `
    CREATE TABLE IF NOT EXISTS departments (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL
    );
  `;

  const createEmployeesTableQuery = `
    CREATE TABLE IF NOT EXISTS employees (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL
    );
  `;

  const seedDepartmentsQuery = `
    INSERT INTO departments (name)
    VALUES 
      ('HR'),
      ('Engineering'),
      ('Sales')
    ON CONFLICT DO NOTHING;
  `;

  const seedEmployeesQuery = `
    INSERT INTO employees (name, department_id)
    VALUES 
      ('Alice', 1),
      ('Bob', 2),
      ('Charlie', 3)
    ON CONFLICT DO NOTHING;
  `;

  try {
    await client.query(createDepartmentsTableQuery);
    await client.query(createEmployeesTableQuery);
    await client.query(seedDepartmentsQuery);
    await client.query(seedEmployeesQuery);
    console.log('Database initialized and tables seeded.');
  } catch (err) {
    console.error('Error initializing database:', err);
  }
};

// API Routes

// GET /api/employees - Returns an array of employees
app.get('/api/employees', async (req, res, next) => {
  try {
    const result = await client.query('SELECT * FROM employees');
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/departments - Returns an array of departments
app.get('/api/departments', async (req, res, next) => {
  try {
    const result = await client.query('SELECT * FROM departments');
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/employees - Creates a new employee
app.post('/api/employees', async (req, res, next) => {
  const { name, department_id } = req.body;
  try {
    const result = await client.query(
      'INSERT INTO employees (name, department_id) VALUES ($1, $2) RETURNING *',
      [name, department_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /api/employees/:id - Updates an existing employee
app.put('/api/employees/:id', async (req, res, next) => {
  const { name, department_id } = req.body;
  try {
    const result = await client.query(
      'UPDATE employees SET name = $1, department_id = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
      [name, department_id, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/employees/:id - Deletes an employee by ID
app.delete('/api/employees/:id', async (req, res, next) => {
  try {
    const result = await client.query('DELETE FROM employees WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    res.status(204).end(); // No content to return
  } catch (err) {
    next(err);
  }
});

// Error handling route
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});

// Static files and serving the front end
app.use(express.static(path.join(__dirname, '../client/dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
