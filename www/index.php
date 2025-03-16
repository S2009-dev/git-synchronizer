<?php
require $_SERVER['DOCUMENT_ROOT'].'/vendor/autoload.php';

use Symfony\Component\Yaml\Yaml;

$filePath = $_SERVER['DOCUMENT_ROOT'].'/config.yml';
$yamlContent = file_get_contents($filePath);
$config = Yaml::parse($yamlContent);

$dotenv = Dotenv\Dotenv::createImmutable($_SERVER['DOCUMENT_ROOT']);
$dotenv->load();

// Verify the github signature header with the secret key -> https://docs.github.com/en/webhooks-and-events/webhooks/securing-your-webhooks
function verifySignature($secret, $header, $payload) {
    $parts = explode("=", $header);
    if (count($parts) !== 2 || $parts[0] !== 'sha256') {
        return false;
    }
    $sigHex = $parts[1];

    $sigBytes = hex2bin($sigHex);
    if ($sigBytes === false) {
        return false;
    }

    $keyBytes = $secret;
    $expectedSig = hash_hmac('sha256', $payload, $keyBytes, true);

    if (hash_equals($expectedSig, $sigBytes)) {
        return true;
    } else {
        return false;
    }
}

// Check if the request is a POST request
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $signatureHeader = $_SERVER['HTTP_X_HUB_SIGNATURE_256'] ?? '';
    $payload = file_get_contents('php://input');
    $secret = $_ENV["SECRET"];
    $base_url = $_ENV["BASE_URL"];

    // Verify the signature
    if (verifySignature($secret, $signatureHeader, $payload)) {
        $data = json_decode($payload, true);

        if(isset($data['zen'])){
            // Handle ping event
            http_response_code(200);
            echo "Ping received";
        } elseif (isset($data['commits']) || (isset($data['release']) && isset($data['action']) && $data['action'] == "published" )) {
            // Handle commit event
            $repo = $data['repository'];
            $conf = $config[$repo['owner']['name']][$repo['name']]['commits'];

            if(isset($data['release'])){
                // Handle release event
                $conf = $config[$repo['owner']['login']][$repo['name']]['releases'];
            }

            if(!isset($conf) || empty($conf)){
                // Handle configuration not found
                http_response_code(404);
                echo "No configuration found for this repository";
                exit();
            }

            $source = $conf['source'];
            $dest = $conf['dest'];
            $cpdir = $conf['cpdir'];
            $postcmd = $conf['postcmd'];
            $args = "--source=$source --dest=$dest --cpdir=$cpdir";

            if(isset($postcmd) && !empty($postcmd)){
                $args = "$args --postcmd=$postcmd";
            }

            $script_path = '/var/git_sync/deployer.sh';
            $command = "bash $script_path $args 2>&1";

            exec($command, $output, $return_var);

            if ($return_var !== 0) {
                // Handle error
                http_response_code(500);
                echo 'An internal error occurred: ' . implode("\n", $output);
            } else {
                // Handle success
                http_response_code(200);
                echo 'Success';
            }
        } else {
            // Handle unknown event
            http_response_code(400);
            echo "Bad Request";
        }
    } else {
        // Handle invalid signature
        http_response_code(401);
        echo "Invalid Signature";
    }
} else {
    // Handle invalid request method
    http_response_code(400);
    echo "Bad Request Method";
}