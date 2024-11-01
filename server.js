const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

 app.use(cors());
app.use(express.json());
//changed pword 
 const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '08817',
  database: 'sakila'
});

 db.connect((err) => {
  if (err) {
    console.error('Database connection failed: ' + err.stack);
    return;
  }
  console.log('Connected to the database');
});

 app.get('/api/films', (req, res) => {
  const query = `
    SELECT f.film_id, f.title, COUNT(r.rental_id) AS rental_count
    FROM film f
    JOIN inventory i ON f.film_id = i.film_id
    JOIN rental r ON i.inventory_id = r.inventory_id
    GROUP BY f.film_id, f.title
    ORDER BY rental_count DESC
    LIMIT 5;
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error('Query error: ' + err.stack);
      return res.status(500).json({ error: 'Database query failed' });
    }
    res.json(results);
  });
});
 
app.get('/api/films/:id', (req, res) => {
  const filmId = req.params.id;
  const query = `
    SELECT 
      f.film_id, 
      f.title, 
      f.description, 
      f.release_year, 
      f.rental_duration, 
      f.rental_rate, 
      f.length, 
      f.replacement_cost, 
      f.rating, 
      f.special_features, 
      f.last_update
    FROM film f
    WHERE film_id = ?;
  `;

  db.query(query, [filmId], (err, results) => {
    if (err) {
      console.error('Query error: ' + err.stack);
      return res.status(500).json({ error: 'Database query failed' });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: 'Film not found' });
    }
    res.json(results[0]);
  });
});


app.get('/api/actors', (req, res) => {
  const query = `
    SELECT a.actor_id, a.first_name, a.last_name, COUNT(f.film_id) AS film_count
    FROM actor a
    JOIN film_actor fa ON a.actor_id = fa.actor_id
    JOIN film f ON fa.film_id = f.film_id
    GROUP BY a.actor_id
    ORDER BY film_count DESC
    LIMIT 5;
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error('Query error: ' + err.stack);
      return res.status(500).json({ error: 'Database query failed' });
    }
    res.json(results);
  });
});

 app.get('/api/actors/:id', (req, res) => {
  const actorId = req.params.id;
  
  const actorQuery = `
    SELECT a.actor_id, a.first_name, a.last_name, COUNT(f.film_id) AS film_count
    FROM actor a
    JOIN film_actor fa ON a.actor_id = fa.actor_id
    JOIN film f ON fa.film_id = f.film_id
    WHERE a.actor_id = ?
    GROUP BY a.actor_id;
  `;

  const filmsQuery = `
    SELECT f.film_id, f.title
    FROM film f
    JOIN film_actor fa ON f.film_id = fa.film_id
    WHERE fa.actor_id = ?
    ORDER BY f.rental_rate DESC
    LIMIT 5;
  `;

  db.query(actorQuery, [actorId], (err, actorResults) => {
    if (err) {
      console.error('Query error: ' + err.stack);
      return res.status(500).json({ error: 'Database query failed' });
    }
    if (actorResults.length === 0) {
      return res.status(404).json({ error: 'Actor not found' });
    }
 
    db.query(filmsQuery, [actorId], (err, filmsResults) => {
      if (err) {
        console.error('Query error: ' + err.stack);
        return res.status(500).json({ error: 'Database query failed' });
      }
      res.json({
        actor: actorResults[0],
        topFilms: filmsResults
      });
    });
  });
});

app.get('/api/customers', (req, res) => {
  const { page = 1, limit = 10, search = '' } = req.query;  
  const offset = (page - 1) * limit;

  const searchPattern = `%${search}%`;  

   const countQuery = `SELECT COUNT(*) AS total FROM customer WHERE first_name LIKE ? OR last_name LIKE ? OR customer_id = ?`;
  db.query(countQuery, [searchPattern, searchPattern, search], (err, countResults) => {
      if (err) {
          return res.status(500).send(err);
      }

      const total = countResults[0].total;

      
      const query = `
          SELECT customer_id, store_id, first_name, last_name, active
          FROM customer
          WHERE first_name LIKE ? OR last_name LIKE ? OR customer_id = ?
          LIMIT ? OFFSET ?
      `;
      db.query(query, [searchPattern, searchPattern, search, parseInt(limit), parseInt(offset)], (err, results) => {
          if (err) {
              return res.status(500).send(err);
          }
          res.json({ results, total });  
      });
  });
});

app.get('/films', async (req, res) => {
  const { page = 1, limit = 10, query = '' } = req.query;

  const offset = (page - 1) * limit;

  
  const queryParts = query.trim().split(' ');
  const firstNameQuery = queryParts[0] ? `%${queryParts[0]}%` : '%';
  const lastNameQuery = queryParts[1] ? `%${queryParts[1]}%` : '%';

  try {
    const sql = `
      SELECT DISTINCT film.film_id, film.title, category.name AS category_name
      FROM film
      LEFT JOIN film_category ON film.film_id = film_category.film_id
      LEFT JOIN category ON film_category.category_id = category.category_id
      LEFT JOIN film_actor ON film.film_id = film_actor.film_id
      LEFT JOIN actor ON film_actor.actor_id = actor.actor_id
      WHERE film.title LIKE ? 
      OR (actor.first_name LIKE ? AND actor.last_name LIKE ?)
      OR category.name LIKE ?
      LIMIT ? OFFSET ?
    `;

    const values = [
      `%${query}%`,   
      firstNameQuery,  
      lastNameQuery,   
      `%${query}%`,    
      parseInt(limit),  
      parseInt(offset)  
    ];

    db.query(sql, values, (error, results) => {
      if (error) {
        console.error('Error executing query:', error);
        return res.status(500).json({ error: 'Database query failed' });
      }

      
      const countSql = `
        SELECT COUNT(DISTINCT film.film_id) AS total
        FROM film
        LEFT JOIN film_category ON film.film_id = film_category.film_id
        LEFT JOIN category ON film_category.category_id = category.category_id
        LEFT JOIN film_actor ON film.film_id = film_actor.film_id
        LEFT JOIN actor ON film_actor.actor_id = actor.actor_id
        WHERE film.title LIKE ? 
        OR (actor.first_name LIKE ? AND actor.last_name LIKE ?)
        OR category.name LIKE ?
      `;
      
      db.query(countSql, values.slice(0, 4), (countError, countResults) => {
        if (countError) {
          console.error('Error executing count query:', countError);
          return res.status(500).json({ error: 'Count query failed' });
        }

        const total = countResults[0].total;

        res.json({
          results: results,
          total: total
        });
      });
    });
  } catch (error) {
    console.error('Error fetching films:', error);
    res.status(500).json({ error: 'An error occurred while fetching films.' });
  }
});
const rentFilm = (req, res) => { 
  const { customerId, filmId } = req.body;

 
  console.log('Received request to rent film:', { customerId, filmId });

  
  const availableCountQuery = `
    SELECT 
        i.inventory_id
    FROM 
        inventory i
    JOIN 
        film f ON i.film_id = f.film_id
    WHERE 
        f.film_id = ? 
        AND i.inventory_id NOT IN (
            SELECT inventory_id 
            FROM rental 
            WHERE return_date IS NULL
        )
    LIMIT 1;  -- Get just one available inventory ID
`;

  db.query(availableCountQuery, [filmId], (err, results) => {
      if (err) {
          console.error('Error checking available copies: ', err);
          return res.status(500).json({ error: 'Error checking availability' });
      }

      console.log('Available copies query results:', results);

      if (!results.length) {
          return res.status(400).json({ error: 'Film is out of stock' });
      }

      const inventoryId = results[0].inventory_id;

     
      const existingRentalQuery = `
          SELECT COUNT(*) AS rental_count 
          FROM rental 
          WHERE customer_id = ? AND inventory_id = ?;
      `;

      db.query(existingRentalQuery, [customerId, inventoryId], (err, results) => {
          if (err) {
              console.error('Error checking existing rentals: ', err);
              return res.status(500).json({ error: 'Error checking existing rentals' });
          }

          const rentalCount = results[0].rental_count;

          if (rentalCount > 0) {
              return res.status(400).json({ error: 'Cannot rent the same film more than once' });
          }

          
          const rentQuery = `
              INSERT INTO rental (rental_date, inventory_id, customer_id, return_date, staff_id)
              VALUES (NOW(), ?, ?, NULL, ?);
          `;

          const defaultStaffId = 1; 

          db.query(rentQuery, [inventoryId, customerId, defaultStaffId], (err) => {
              if (err) {
                  console.error('Error inserting rental: ', err);
                  return res.status(500).json({ error: 'Rental failed' });
              }

              res.json({ message: 'Film rented successfully' });
          });
      });
  });
};

app.post('/api/rent', rentFilm);

app.post('/api/customers', async (req, res) => {
  const { first_name, last_name, email, address, address2, city, district, country, postal_code, phone } = req.body;

  try {
    const [emailResults] = await db.promise().query('SELECT * FROM customer WHERE email = ?', [email]);
    if (emailResults.length > 0) {
      return res.json({ success: false, message: 'Email is already in use' });
    }

    const [countryResults] = await db.promise().query('SELECT country_id FROM country WHERE country = ?', [country]);
    let countryID;
    if (countryResults.length > 0) {
      countryID = countryResults[0].country_id;
    } else {
      const [insertedCountry] = await db.promise().query('INSERT INTO country (country, last_update) VALUES (?, NOW())', [country]);
      countryID = insertedCountry.insertId; 
    }

    
    const [cityResults] = await db.promise().query('SELECT city_id FROM city WHERE city = ?', [city]);
    let cityID;
    if (cityResults.length > 0) {
      cityID = cityResults[0].city_id;
    } else {
      const [insertedCity] = await db.promise().query('INSERT INTO city (city, country_id, last_update) VALUES (?, ?, NOW())', [city, countryID]);
      cityID = insertedCity.insertId; 
    }

    const [addressInsertResult] = await db.promise().query(
      `INSERT INTO address (address, address2, district, city_id, postal_code, phone, location, last_update)
       VALUES (?, ?, ?, ?, ?, ?, POINT(1, 1), NOW())`, 
      [address, address2, district, cityID, postal_code, phone]
    );

    const addressID = addressInsertResult.insertId;

    const [customerResult] = await db.promise().query(
      `INSERT INTO customer (store_id, first_name, last_name, email, address_id, active, create_date)
       VALUES (1, ?, ?, ?, ?, 1, NOW())`, 
      [first_name, last_name, email, addressID]
    );

    res.json({ success: true, customer_id: customerResult.insertId });
    
  } catch (error) {
    console.error('Error:', error.stack);
    res.status(500).json({ error: 'An error occurred while processing your request' });
  }
});


app.delete('/api/customers/:id', async (req, res) => {
  const customerId = req.params.id;

  try {
      const [rentalResults] = await db.promise().query('SELECT COUNT(*) AS rental_count FROM rental WHERE customer_id = ?', [customerId]);
      
      if (rentalResults[0].rental_count > 0) {
          return res.status(400).json({ success: false, message: 'Cannot delete customer with active rentals.' });
      }

      await db.promise().query('DELETE FROM customer WHERE customer_id = ?', [customerId]);
      
      res.json({ success: true });
  } catch (error) {
      console.error('Error deleting customer:', error.stack);
      res.status(500).json({ error: 'An error occurred while deleting the customer' });
  }
});


app.get('/api/customers', async (req, res) => {
  const { page = 1, limit = 10, search = '' } = req.query;
  const offset = (page - 1) * limit;

  try {
      const [results] = await connection.execute(
          `SELECT * FROM customer
          WHERE first_name LIKE ? OR last_name LIKE ?
          LIMIT ? OFFSET ?`,
          [`%${search}%`, `%${search}%`, limit, offset]
      );
      
      const [countResult] = await connection.execute(
          `SELECT COUNT(*) AS total FROM customer
          WHERE first_name LIKE ? OR last_name LIKE ?`,
          [`%${search}%`, `%${search}%`]
      );

      res.json({
          results,
          total: countResult[0].total,
      });
  } catch (error) {
      console.error('Error fetching customers:', error);
      res.status(500).send('Internal Server Error');
  }
});


app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});