<?php
// Обработка формы регистрации
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Метод не разрешен']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);

// Валидация
$errors = [];

if (empty($data['email']) || !filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
    $errors[] = 'Некорректный email';
}

if (empty($data['password']) || strlen($data['password']) < 6) {
    $errors[] = 'Пароль должен быть не менее 6 символов';
}

if (empty($data['name'])) {
    $errors[] = 'Имя обязательно';
}

if (!empty($errors)) {
    http_response_code(400);
    echo json_encode(['errors' => $errors]);
    exit;
}

// Здесь должна быть логика регистрации пользователя в БД

echo json_encode([
    'success' => true,
    'message' => 'Регистрация успешна',
    'user_id' => rand(1, 1000)
]);
?>