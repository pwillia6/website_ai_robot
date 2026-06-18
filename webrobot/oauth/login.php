<?php

require_once __DIR__ . '/../LoginCheckerInterface.php';
require_once __DIR__ . '/../WebRobotLoginChecker_OAuth.php';

if (session_status() == PHP_SESSION_NONE) {
    session_start();
}

// Check if a provider is selected (e.g., from a login button click)
$provider = isset($_GET['provider']) ? $_GET['provider'] : null;

if ($provider) {
    // A provider was chosen, set it in the session and redirect to start the login flow.
    \WebRobot\OAuth::setProvider($provider);
    header('Location: ' . $_SERVER['PHP_SELF']);
    exit;
}

// Initialize OAuth object. It will be false if no provider has been set.
$oauth = \WebRobot\OAuth::initialize($_SERVER['PHP_SELF']);

if ($oauth === false) {
    // User is not logged in and has not chosen a provider. Check configured providers.
    $configuredProviders = \WebRobot\OAuth::getConfiguredProviders();

    if (count($configuredProviders) === 1) {
        // Only one provider is configured, so redirect to it automatically.
        $singleProvider = $configuredProviders[0];
        \WebRobot\OAuth::setProvider($singleProvider);
        header('Location: ' . $_SERVER['PHP_SELF']);
        exit;
    }

    // If 0 or more than 1 providers are configured, display the choice page.
    // The buttons will be shown dynamically based on the configuration.
    ?>
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>Robot Login</title>
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
            }
            .login-container {
                background-color: white;
                padding: 40px;
                border-radius: 10px;
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
                text-align: center;
                width: 100%;
                max-width: 400px;
            }
            .app-title {
                font-size: 24px;
                font-weight: 600;
                color: #333;
                margin-bottom: 10px;
            }
            .login-container h2 {
                color: #555;
                margin-bottom: 30px;
                font-weight: 400;
            }
            .login-button {
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 12px 20px;
                margin: 10px 0;
                color: white;
                text-decoration: none;
                border-radius: 5px;
                font-weight: 500;
                transition: background-color 0.3s ease;
                border: none;
                cursor: pointer;
            }
            .google { background-color: #DB4437; }
            .google:hover { background-color: #C33D2E; }
            .microsoft { background-color: #0078D4; }
            .microsoft:hover { background-color: #005A9E; }
        </style>
    </head>
    <body>
        <div class="login-container">
            <h1 class="app-title">Webrobot Login</h1>
            <h2>&nbsp;</h2>
            <?php if (in_array('google', $configuredProviders)): ?>
                <a href="?provider=google" class="login-button google">Sign in with Google</a>
            <?php endif; ?>
            <?php if (in_array('microsoft', $configuredProviders)): ?>
                <a href="?provider=microsoft" class="login-button microsoft">Sign in with Microsoft</a>
            <?php endif; ?>
            <?php if (empty($configuredProviders)): ?>
                <p>No login providers are configured.</p>
            <?php endif; ?>
        </div>
    </body>
    </html>
    <?php
    exit; // Stop the script until a provider is chosen
}

// The login method handles the entire OAuth flow:
// 1. Redirects to the provider if not logged in.
// 2. Processes the callback from the provider.
// 3. Ensures a valid token exists by checking expiration and refreshing if needed.
$oauth->login();


$user = $oauth->user();
error_log("OAUTH User Details (base64): " . base64_encode(print_r($user, true)));
//print_r($user); exit;

$email = strtolower($user->email);

if (isAuthorized($email)) {
    // On success, redirect to the intended page or the default admin index.
    if (isset($_SESSION['login_redirect'])) {
        $redirect_url = $_SESSION['login_redirect'];
        unset($_SESSION['login_redirect']);
        header("Location: " . $redirect_url);
    } else {
        header("Location: /");
    }
    exit;
} else {
    echo "Email $email does not have access\n";
    error_log("OAUTH: Email $email does not have access");
    exit;
}
