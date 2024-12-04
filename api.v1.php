<?php
// Database configuration
$host = 'localhost';
$username = 'your_username';
$password = 'your_password';
$database = 'your_database';
$tableName = '';

// Handle CORS preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    exit(0);
}

// Set CORS headers for all responses
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Create a connection
$conn = new mysqli($host, $username, $password, $database);

// Check connection
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

// Get limit, offset, start_date, and end_date from URL query parameters
$limit = isset($_GET['limit']) ? intval($_GET['limit']) : 10;
$offset = isset($_GET['offset']) ? intval($_GET['offset']) : 0;
$start_date = isset($_GET['start_date']) ? $_GET['start_date'] : null;
$end_date = isset($_GET['end_date']) ? $_GET['end_date'] : date('Y-m-d');

// Validate date format (YYYY-MM-DD)
function validateDate($date, $format = 'Y-m-d')
{
    $d = DateTime::createFromFormat($format, $date);
    return $d && $d->format($format) === $date;
}

if ($start_date && !validateDate($start_date)) {
    die(json_encode(['error' => 'Invalid start_date format. Use YYYY-MM-DD']));
}

// SQL query to select data with limit, offset, and optional date range
$sql = "SELECT * FROM $tableName WHERE 1=1";
$params = [];
$types = "";

// Add date range filtering if start_date and end_date are provided
if ($start_date && $end_date) {
    $sql .= " AND created_at BETWEEN ? AND ?";
    $params[] = $start_date;
    $params[] = $end_date;
    $types .= "ss"; // Two strings
}

// Append limit and offset
$sql .= "  ORDER BY created_at DESC LIMIT ? OFFSET ?";
$params[] = $limit;
$params[] = $offset;
$types .= "ii"; // Two integers

// Prepare and bind
$stmt = $conn->prepare($sql);

// Check if prepare() failed and output the error
if (!$stmt) {
    http_response_code(500);
    die(json_encode(['error' => 'Prepare failed: ' . $conn->error]));
}

// Use a variable length argument list to bind parameters dynamically
$stmt->bind_param($types, ...$params);

// Execute the query
$stmt->execute();

// Get the result
$result = $stmt->get_result();

// Fetch all data
$data = $result->fetch_all(MYSQLI_ASSOC);

// Return JSON encoded data
header('Content-Type: application/json');
echo json_encode($data);

// Close the connection
$stmt->close();
$conn->close();
